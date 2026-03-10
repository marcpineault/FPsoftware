import type { Client, ProjectionRow, KeyMetrics, ProjectionParams, CanadianProvince } from '../types';
import {
  CPP_MAX_MONTHLY_2025,
  CPP_YMPE_2025,
  CPP_BASIC_EXEMPTION,
  FEDERAL_TAX_BRACKETS,
  FEDERAL_BASIC_PERSONAL_AMOUNT,
  PROVINCIAL_TAX_DATA,
  OAS_CLAWBACK_THRESHOLD,
  OAS_CLAWBACK_RATE,
  OAS_MAX_MONTHLY_65_74,
  OAS_MAX_MONTHLY_75_PLUS,
  OAS_DEFERRAL_INCREASE_PER_MONTH,
  RRIF_MIN_WITHDRAWAL_RATES,
  RRSP_TO_RRIF_AGE,
  FHSA_ANNUAL_LIMIT,
  FHSA_LIFETIME_LIMIT,
  CESG_RATE,
  CESG_ANNUAL_MAX,
  CESG_LIFETIME_MAX,
  RESP_BENEFICIARY_MAX_AGE,
  GIS_MAX_MONTHLY_SINGLE,
  GIS_MAX_MONTHLY_COUPLE,
  GIS_INCOME_THRESHOLD_SINGLE,
  GIS_INCOME_THRESHOLD_COUPLE,
  GIS_CLAWBACK_RATE_SINGLE,
  GIS_CLAWBACK_RATE_COUPLE,
} from '../constants';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAge(dateOfBirth: string, referenceYear: number): number {
  if (!dateOfBirth) return 30; // fallback
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 30;
  return referenceYear - dob.getFullYear();
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

/* ------------------------------------------------------------------ */
/*  Mortgage Amortization                                              */
/* ------------------------------------------------------------------ */

/**
 * Calculate remaining mortgage balance after N years of payments.
 * Uses standard amortization formula.
 */
function calculateMortgageRemaining(
  originalBalance: number,
  annualRate: number,
  amortizationYears: number,
  yearsElapsed: number,
): number {
  if (originalBalance <= 0 || yearsElapsed >= amortizationYears) return 0;
  if (annualRate <= 0) {
    // Interest-free: linear paydown
    return Math.max(0, originalBalance * (1 - yearsElapsed / amortizationYears));
  }
  const monthlyRate = annualRate / 12;
  const totalPayments = amortizationYears * 12;
  const paymentsMade = yearsElapsed * 12;
  // Monthly payment
  const monthlyPayment = originalBalance * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))
    / (Math.pow(1 + monthlyRate, totalPayments) - 1);
  // Remaining balance after paymentsMade payments
  const remaining = originalBalance * Math.pow(1 + monthlyRate, paymentsMade)
    - monthlyPayment * (Math.pow(1 + monthlyRate, paymentsMade) - 1) / monthlyRate;
  return Math.max(0, Math.round(remaining));
}

/* ------------------------------------------------------------------ */
/*  GIS (Guaranteed Income Supplement)                                 */
/* ------------------------------------------------------------------ */

/**
 * Calculate GIS for low-income retirees aged 65+.
 * GIS is clawed back based on net income (excluding OAS).
 * Returns annual GIS amount.
 */
function calculateGis(
  netIncomeExcludingOas: number,
  hasSpouse: boolean,
): number {
  if (hasSpouse) {
    const maxAnnual = GIS_MAX_MONTHLY_COUPLE * 12;
    if (netIncomeExcludingOas >= GIS_INCOME_THRESHOLD_COUPLE) return 0;
    const clawback = netIncomeExcludingOas * GIS_CLAWBACK_RATE_COUPLE;
    return Math.max(0, Math.round(maxAnnual - clawback));
  } else {
    const maxAnnual = GIS_MAX_MONTHLY_SINGLE * 12;
    if (netIncomeExcludingOas >= GIS_INCOME_THRESHOLD_SINGLE) return 0;
    const clawback = netIncomeExcludingOas * GIS_CLAWBACK_RATE_SINGLE;
    return Math.max(0, Math.round(maxAnnual - clawback));
  }
}

/* ------------------------------------------------------------------ */
/*  Tax Calculation — Bracket-based                                    */
/* ------------------------------------------------------------------ */

/**
 * Calculate tax using a set of progressive brackets.
 * Brackets are { min, max, rate } — tax is applied on income within [min, max).
 */
function calculateBracketTax(
  taxableIncome: number,
  brackets: { min: number; max: number; rate: number }[],
): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

/**
 * Calculate federal income tax using the official brackets and basic personal amount.
 * The basic personal amount is a non-refundable credit at the lowest bracket rate.
 */
function calculateFederalTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const grossTax = calculateBracketTax(taxableIncome, FEDERAL_TAX_BRACKETS);
  // Non-refundable credit: personal amount * lowest bracket rate
  const lowestRate = FEDERAL_TAX_BRACKETS[0].rate;
  const personalCredit = FEDERAL_BASIC_PERSONAL_AMOUNT * lowestRate;
  return Math.max(0, grossTax - personalCredit);
}

/**
 * Calculate provincial income tax using the province's official brackets
 * and basic personal amount (applied as a non-refundable credit at lowest rate).
 */
function calculateProvincialTax(taxableIncome: number, province: CanadianProvince): number {
  if (taxableIncome <= 0) return 0;
  const provData = PROVINCIAL_TAX_DATA[province];
  if (!provData) return 0;
  const grossTax = calculateBracketTax(taxableIncome, provData.brackets);
  const lowestRate = provData.brackets[0].rate;
  const personalCredit = provData.personalAmount * lowestRate;
  return Math.max(0, grossTax - personalCredit);
}

/**
 * Full income tax estimate: federal + provincial.
 */
function estimateIncomeTax(taxableIncome: number, province: CanadianProvince): number {
  if (taxableIncome <= 0) return 0;
  return Math.round(calculateFederalTax(taxableIncome) + calculateProvincialTax(taxableIncome, province));
}

/* ------------------------------------------------------------------ */
/*  OAS Clawback                                                       */
/* ------------------------------------------------------------------ */

/**
 * OAS Recovery Tax (clawback). When net income exceeds the threshold,
 * OAS is clawed back at 15% of the excess. Fully eliminated when
 * clawback >= the OAS amount.
 */
function calculateOasClawback(netIncome: number, oasAmount: number): number {
  if (netIncome <= OAS_CLAWBACK_THRESHOLD) return 0;
  const clawback = (netIncome - OAS_CLAWBACK_THRESHOLD) * OAS_CLAWBACK_RATE;
  return Math.min(clawback, oasAmount);
}

/* ------------------------------------------------------------------ */
/*  RRIF Minimum Withdrawal                                            */
/* ------------------------------------------------------------------ */

/**
 * Get the RRIF minimum withdrawal rate for a given age.
 * After age 71, a minimum percentage of the RRIF balance must be withdrawn.
 * For ages beyond the table (95+), use 20%.
 */
function getRrifMinimumRate(age: number): number {
  if (age <= RRSP_TO_RRIF_AGE) return 0;
  return RRIF_MIN_WITHDRAWAL_RATES[age] ?? 0.2000;
}

/**
 * Calculate the mandatory minimum RRIF withdrawal for the year.
 */
function calculateRrifMinimum(balance: number, age: number): number {
  const rate = getRrifMinimumRate(age);
  return Math.round(balance * rate);
}

/* ------------------------------------------------------------------ */
/*  CPP & OAS benefit estimators                                       */
/* ------------------------------------------------------------------ */

/**
 * Estimate CPP annual benefit adjusted for early/late commencement.
 * -0.6% per month before 65, +0.7% per month after 65.
 */
function calculateCppAnnual(estimatedMonthlyAt65: number, startAge: number): number {
  const monthsDiff = (startAge - 65) * 12;
  let adjustment: number;
  if (monthsDiff < 0) {
    adjustment = 1 + monthsDiff * 0.006; // reduction
  } else {
    adjustment = 1 + monthsDiff * 0.007; // enhancement
  }
  adjustment = Math.max(0, adjustment);
  return Math.round(estimatedMonthlyAt65 * 12 * adjustment);
}

/**
 * Estimate OAS annual benefit using CRA max monthly amounts.
 * Base: $727.67/month (ages 65-74), $800.44/month (75+).
 * Deferral bonus: +0.6% per month deferred (max to age 70 = 36% increase).
 * The age parameter is the current age being projected for, to apply 75+ boost.
 */
function calculateOasAnnual(startAge: number, currentAge: number): number {
  // Use the appropriate monthly rate based on age
  const baseMonthly = currentAge >= 75 ? OAS_MAX_MONTHLY_75_PLUS : OAS_MAX_MONTHLY_65_74;
  const baseAnnual = baseMonthly * 12;
  // Deferral enhancement: 0.6% per month after 65, max 5 years (60 months)
  const monthsDeferred = Math.max(0, Math.min(startAge - 65, 5)) * 12;
  const adjustment = 1 + monthsDeferred * OAS_DEFERRAL_INCREASE_PER_MONTH;
  return Math.round(baseAnnual * adjustment);
}

/* ------------------------------------------------------------------ */
/*  Tax bracket targeting                                              */
/* ------------------------------------------------------------------ */

/**
 * Determine the optimal RRSP/RRIF withdrawal amount to "fill up" low
 * tax brackets. Target: top of the second-lowest federal bracket
 * (~$57,375 + basic personal amount for the credit zone), which keeps
 * marginal rate at 15% federally. Also stay below OAS clawback threshold
 * if receiving OAS.
 */
function getOptimalRrspWithdrawalTarget(
  existingTaxableIncome: number,
  receivingOas: boolean,
): number {
  // Target the top of the first federal bracket to stay at the lowest federal rate
  const conservativeTarget = FEDERAL_TAX_BRACKETS[0].max; // ~$57,375

  // If receiving OAS, also cap below clawback threshold
  let target = conservativeTarget;
  if (receivingOas) {
    target = Math.min(target, OAS_CLAWBACK_THRESHOLD);
  }

  const room = Math.max(0, target - existingTaxableIncome);
  return room;
}

/* ------------------------------------------------------------------ */
/*  Non-Registered Account Helpers                                     */
/* ------------------------------------------------------------------ */

/**
 * For non-reg accounts, we track an adjusted cost base (ACB).
 * On withdrawal, only the capital gain portion is taxable at 50% inclusion.
 * We also model a blended annual taxable distribution of ~2% of balance
 * (dividends + interest generated within the account).
 */
function calculateNonRegTaxableGain(
  withdrawalAmount: number,
  currentBalance: number,
  currentAcb: number,
): number {
  if (withdrawalAmount <= 0 || currentBalance <= 0) return 0;
  // Proportion of the account being withdrawn
  const proportion = Math.min(1, withdrawalAmount / currentBalance);
  // Capital gain = withdrawal - proportional ACB
  const acbPortion = currentAcb * proportion;
  const capitalGain = Math.max(0, withdrawalAmount - acbPortion);
  // 50% inclusion rate for capital gains
  return Math.round(capitalGain * 0.5);
}

/**
 * Annual taxable distribution from non-reg account (dividends, interest).
 * Assumed at ~2% of balance.
 */
const NON_REG_ANNUAL_TAXABLE_DISTRIBUTION_RATE = 0.02;

function calculateNonRegAnnualDistribution(balance: number): number {
  return Math.round(balance * NON_REG_ANNUAL_TAXABLE_DISTRIBUTION_RATE);
}

/* ------------------------------------------------------------------ */
/*  Pension Income Splitting                                           */
/* ------------------------------------------------------------------ */

/**
 * Optimize pension income splitting between spouses.
 * Up to 50% of eligible pension income (DB pension, RRIF withdrawals if 65+,
 * annuity payments) can be allocated to the spouse for tax purposes.
 * CPP and OAS are NOT eligible.
 */
function optimizePensionSplit(
  clientTaxableIncome: number,
  spouseTaxableIncome: number,
  eligiblePensionIncome: number,
  province: CanadianProvince,
): { splitPercentage: number; taxSavings: number } {
  // Try splits from 0% to 50% in 5% increments
  // Find the split that minimizes total household tax
  let bestSplit = 0;
  let bestTotalTax = Infinity;

  for (let pct = 0; pct <= 50; pct += 5) {
    const splitAmount = eligiblePensionIncome * (pct / 100);
    const clientTax = estimateIncomeTax(clientTaxableIncome - splitAmount, province);
    const spouseTax = estimateIncomeTax(spouseTaxableIncome + splitAmount, province);
    const totalTax = clientTax + spouseTax;
    if (totalTax < bestTotalTax) {
      bestTotalTax = totalTax;
      bestSplit = pct;
    }
  }

  const noSplitTax = estimateIncomeTax(clientTaxableIncome, province)
    + estimateIncomeTax(spouseTaxableIncome, province);
  return { splitPercentage: bestSplit, taxSavings: noSplitTax - bestTotalTax };
}

/* ------------------------------------------------------------------ */
/*  Main projection generator                                          */
/* ------------------------------------------------------------------ */

export function generateProjections(client: Client): ProjectionRow[] {
  const params = client.projectionParams;
  const currentYear = getCurrentYear();
  const currentAge = getAge(client.dateOfBirth, currentYear);
  const projectionEndAge = 95;
  const totalYears = projectionEndAge - currentAge + 1;

  if (totalYears <= 0 || currentAge < 18) return [];

  const rows: ProjectionRow[] = [];

  // Starting balances
  let rrspBalance = client.rrspBalance;
  let tfsaBalance = client.tfsaBalance;
  let nonRegBalance = client.nonRegisteredInvestments;
  // ACB for non-reg: initially equal to contributions (the starting balance)
  let nonRegAcb = client.nonRegisteredInvestments;
  // FHSA tracking
  let fhsaBalance = client.fhsaBalance ?? 0;
  let fhsaCumulativeContributions = fhsaBalance; // assume starting balance was all contributions

  // RESP tracking
  let respBalance = client.children.reduce((sum, c) => sum + (c.respBalance ?? 0), 0);
  let cumulativeCesg = 0; // track total CESG received

  // Pension income (DB or DC)
  const hasPension = client.pensionType !== 'none';
  const pensionAnnualBenefit = client.pensionDetails?.annualBenefitEstimate ?? 0;

  // Current annual spending
  const currentAnnualSpending = client.monthlyExpenses * 12;
  const retirementSpending = currentAnnualSpending * params.retirementSpendingRate;

  // CPP annual amount (base, before inflation)
  const cppAnnual = calculateCppAnnual(params.estimatedCppMonthly, params.cppStartAge);

  // Spouse info
  const hasSpouse = client.hasSpouse && client.spouse != null;
  const spouseDob = hasSpouse ? client.spouse!.dateOfBirth : '';
  const spouseRetirementAge = hasSpouse ? client.spouse!.targetRetirementAge : 65;
  const spouseAnnualIncome = hasSpouse ? client.spouse!.annualIncome : 0;
  const spouseCppMonthly = hasSpouse ? (client.spouse!.estimatedCppMonthly ?? 0) : 0;
  const spouseCppStartAge = hasSpouse ? (client.spouse!.cppStartAge ?? 65) : 65;
  const spouseOasStartAge = hasSpouse ? (client.spouse!.oasStartAge ?? 65) : 65;
  const spouseCppAnnual = spouseCppMonthly > 0 ? calculateCppAnnual(spouseCppMonthly, spouseCppStartAge) : 0;

  for (let i = 0; i < totalYears; i++) {
    const year = currentYear + i;
    const age = currentAge + i;
    const isRetired = age >= params.retirementAge;

    // Spouse age tracking
    const spouseAge = hasSpouse ? getAge(spouseDob, year) : undefined;
    const isSpouseRetired = hasSpouse ? (spouseAge! >= spouseRetirementAge) : true;

    // Inflation factor from current year
    const inflationFactor = Math.pow(1 + params.inflationRate, i);

    // --- Income sources ---

    // Employment income (grows with inflation until retirement)
    const employmentIncome = isRetired
      ? 0
      : Math.round(client.annualIncome * Math.pow(1 + Math.min(params.inflationRate, 0.03), i));

    // Spouse employment income (until spouse's retirement)
    const spouseEmploymentIncome = hasSpouse && !isSpouseRetired
      ? Math.round(spouseAnnualIncome * Math.pow(1 + Math.min(params.inflationRate, 0.03), i))
      : 0;

    // CPP (starts at cppStartAge, inflation-indexed)
    const cpp = age >= params.cppStartAge ? Math.round(cppAnnual * inflationFactor) : 0;

    // OAS (starts at oasStartAge, inflation-indexed) — before clawback
    // Recalculated each year to apply 75+ enhancement when age crosses 75
    const oasAnnualForAge = calculateOasAnnual(params.oasStartAge, age);
    const oasGross = age >= params.oasStartAge ? Math.round(oasAnnualForAge * inflationFactor) : 0;

    // Spouse's CPP and OAS (if applicable)
    const spouseCpp = hasSpouse && spouseAge != null && spouseAge >= spouseCppStartAge
      ? Math.round(spouseCppAnnual * inflationFactor) : 0;
    const spouseOasAnnual = hasSpouse && spouseAge != null && spouseAge >= spouseOasStartAge
      ? calculateOasAnnual(spouseOasStartAge, spouseAge) : 0;
    const spouseOasGross = spouseOasAnnual > 0 ? Math.round(spouseOasAnnual * inflationFactor) : 0;

    // Pension income (starts at retirement, inflation-indexed)
    const pensionIncome = isRetired && hasPension
      ? Math.round(pensionAnnualBenefit * inflationFactor)
      : 0;

    // --- Pre-retirement: grow balances with contributions ---
    if (!isRetired) {
      rrspBalance = rrspBalance * (1 + params.rrspReturnRate) + client.rrspAnnualContribution;
      tfsaBalance = tfsaBalance * (1 + params.tfsaReturnRate) + client.tfsaAnnualContribution;
      nonRegBalance = nonRegBalance * (1 + params.nonRegReturnRate);
      // ACB doesn't change with growth, only with new contributions
      // (assuming no additional non-reg contributions for simplicity)

      // FHSA: grow at TFSA return rate and add contributions up to limits
      fhsaBalance = fhsaBalance * (1 + params.tfsaReturnRate);
      const fhsaRoomRemaining = FHSA_LIFETIME_LIMIT - fhsaCumulativeContributions;
      if (fhsaRoomRemaining > 0 && client.fhsaAnnualContribution > 0) {
        const fhsaContribution = Math.min(
          client.fhsaAnnualContribution,
          FHSA_ANNUAL_LIMIT,
          fhsaRoomRemaining,
        );
        fhsaBalance += fhsaContribution;
        fhsaCumulativeContributions += fhsaContribution;
      }

      // RESP: grow + contributions + CESG matching
      if (respBalance > 0 || client.respAnnualContribution > 0) {
        respBalance = respBalance * (1 + params.tfsaReturnRate); // grow at balanced rate
        const annualContrib = client.respAnnualContribution;
        if (annualContrib > 0) {
          respBalance += annualContrib;
          // CESG: 20% match on first $2,500/child/year, max $500/child/year, lifetime $7,200/child
          const eligibleChildren = client.children.filter((ch) => {
            const childAge = ch.dateOfBirth ? getAge(ch.dateOfBirth, year) : 0;
            return childAge >= 0 && childAge <= RESP_BENEFICIARY_MAX_AGE;
          });
          const numEligible = Math.max(eligibleChildren.length, 1); // at least 1 if contributing
          const cesgPerChild = Math.min(annualContrib / numEligible * CESG_RATE, CESG_ANNUAL_MAX);
          const cesgRoom = CESG_LIFETIME_MAX * numEligible - cumulativeCesg;
          const cesgGrant = Math.min(cesgPerChild * numEligible, cesgRoom);
          if (cesgGrant > 0) {
            respBalance += cesgGrant;
            cumulativeCesg += cesgGrant;
          }
        }
      }
    }

    // --- Expenses (household) ---
    const baseExpenses = isRetired
      ? Math.round(retirementSpending * inflationFactor)
      : Math.round(currentAnnualSpending * inflationFactor);

    // Household expenses remain the same; spouse income helps cover them
    const expenses = baseExpenses;

    // --- Calculate withdrawal needs in retirement ---
    let rrspWithdrawal = 0;
    let tfsaWithdrawal = 0;
    let nonRegWithdrawal = 0;
    let rrifMinimumWithdrawal = 0;
    let nonRegTaxableGain = 0;

    if (isRetired) {
      // ============================================================
      // FHSA: Transfer remaining balance to RRSP at retirement
      // (tax-free transfer, no contribution room impact)
      // ============================================================
      if (fhsaBalance > 0) {
        rrspBalance += fhsaBalance;
        fhsaBalance = 0;
      }

      // ============================================================
      // STEP 1: RRIF mandatory minimum (age > 71)
      // ============================================================
      const isRrif = age > RRSP_TO_RRIF_AGE;
      if (isRrif && rrspBalance > 0) {
        rrifMinimumWithdrawal = calculateRrifMinimum(rrspBalance, age);
      }

      // ============================================================
      // STEP 2: Determine income & shortfall
      // ============================================================
      // Guaranteed/known income before investment withdrawals
      const guaranteedIncome = cpp + oasGross + pensionIncome + spouseEmploymentIncome + spouseCpp + spouseOasGross;

      // Annual non-reg taxable distribution (dividends/interest generated in account)
      const nonRegDistribution = calculateNonRegAnnualDistribution(nonRegBalance);

      // Income that is already taxable (before any withdrawals)
      // RRIF minimum counts as taxable income
      const baseTaxableIncome = cpp + oasGross + pensionIncome + rrifMinimumWithdrawal + nonRegDistribution;

      // ============================================================
      // STEP 3: Tax-optimized withdrawal strategy
      // ============================================================
      // First, apply RRIF minimum withdrawal
      if (rrifMinimumWithdrawal > 0) {
        rrspWithdrawal = rrifMinimumWithdrawal;
        rrspBalance = Math.max(0, rrspBalance - rrspWithdrawal);
      }

      // After-tax estimate of guaranteed income + RRIF minimum
      const incomeBeforeDiscretionary = guaranteedIncome + rrspWithdrawal + nonRegDistribution;
      const taxOnBaseIncome = estimateIncomeTax(
        baseTaxableIncome,
        client.province,
      );
      const afterTaxBase = incomeBeforeDiscretionary - taxOnBaseIncome;

      const shortfall = Math.max(0, expenses - afterTaxBase);

      if (shortfall > 0) {
        // We need more money. Follow the tax-efficient withdrawal order:
        // (a) Non-registered first (only capital gains at 50% inclusion)
        // (b) RRSP/RRIF up to bracket target (stay in low brackets, avoid OAS clawback)
        // (c) TFSA last (tax-free, let it grow)

        let remainingShortfall = shortfall;

        // (a) Non-registered withdrawals
        if (nonRegBalance > 0 && remainingShortfall > 0) {
          // Non-reg withdrawals are mostly tax-efficient (50% capital gains inclusion)
          // Gross up slightly: effective tax on capital gains is lower
          const nonRegGrossUp = 1.1; // ~10% effective tax on capital gains portion
          const desiredNonReg = Math.min(nonRegBalance, remainingShortfall * nonRegGrossUp);
          nonRegWithdrawal = Math.round(desiredNonReg);

          // Calculate taxable portion of this withdrawal
          nonRegTaxableGain = calculateNonRegTaxableGain(nonRegWithdrawal, nonRegBalance, nonRegAcb);

          // Update ACB proportionally
          const proportion = nonRegWithdrawal / nonRegBalance;
          nonRegAcb = Math.max(0, nonRegAcb * (1 - proportion));
          nonRegBalance = Math.max(0, nonRegBalance - nonRegWithdrawal);

          // Approximate after-tax value of this withdrawal
          const taxOnGain = estimateIncomeTax(
            baseTaxableIncome + nonRegTaxableGain,
            client.province,
          ) - taxOnBaseIncome;
          const afterTaxNonReg = nonRegWithdrawal - Math.max(0, taxOnGain);
          remainingShortfall = Math.max(0, remainingShortfall - afterTaxNonReg);
        }

        // (b) Additional RRSP/RRIF withdrawals — target low bracket
        if (rrspBalance > 0 && remainingShortfall > 0) {
          const currentTaxableWithRrsp = baseTaxableIncome + nonRegTaxableGain;
          const receivingOas = oasGross > 0;
          const bracketRoom = getOptimalRrspWithdrawalTarget(currentTaxableWithRrsp, receivingOas);

          // We need to gross up for tax since RRSP is fully taxable
          const marginalRate = 0.30; // approximate combined marginal rate in low brackets
          const grossNeeded = remainingShortfall / (1 - marginalRate);

          // Don't exceed bracket room if possible, but do if we must
          let additionalRrsp: number;
          if (grossNeeded <= bracketRoom) {
            additionalRrsp = Math.round(grossNeeded);
          } else {
            // Take what's in the bracket, then take more if still short
            additionalRrsp = Math.round(grossNeeded);
          }
          additionalRrsp = Math.min(additionalRrsp, rrspBalance);

          rrspWithdrawal += additionalRrsp;
          rrspBalance = Math.max(0, rrspBalance - additionalRrsp);

          // Estimate after-tax value
          const afterTaxRrsp = additionalRrsp * (1 - marginalRate);
          remainingShortfall = Math.max(0, remainingShortfall - afterTaxRrsp);
        }

        // (c) TFSA withdrawals last — completely tax-free
        if (tfsaBalance > 0 && remainingShortfall > 0) {
          tfsaWithdrawal = Math.min(tfsaBalance, Math.round(remainingShortfall));
          tfsaBalance = Math.max(0, tfsaBalance - tfsaWithdrawal);
          remainingShortfall = Math.max(0, remainingShortfall - tfsaWithdrawal);
        }
      }

      // Grow remaining balances after withdrawals
      rrspBalance = rrspBalance * (1 + params.rrspReturnRate);
      tfsaBalance = tfsaBalance * (1 + params.tfsaReturnRate);
      nonRegBalance = nonRegBalance * (1 + params.nonRegReturnRate);
    }

    // Round withdrawals
    rrspWithdrawal = Math.round(rrspWithdrawal);
    tfsaWithdrawal = Math.round(tfsaWithdrawal);
    nonRegWithdrawal = Math.round(nonRegWithdrawal);
    rrifMinimumWithdrawal = Math.round(rrifMinimumWithdrawal);

    // --- Compute final taxable income and tax ---
    // Taxable income: employment + CPP + OAS + pension + RRSP/RRIF withdrawals
    //   + non-reg taxable gain + non-reg annual distribution
    // TFSA withdrawals are NOT taxable
    // Non-reg withdrawal: only the capital gain at 50% inclusion is taxable
    const nonRegDistribution = isRetired ? calculateNonRegAnnualDistribution(
      // Use pre-withdrawal balance approximation (already withdrawn above, so add back)
      nonRegBalance / (1 + params.nonRegReturnRate) + nonRegWithdrawal
    ) : calculateNonRegAnnualDistribution(nonRegBalance);

    const taxableIncome = employmentIncome
      + cpp
      + oasGross
      + pensionIncome
      + rrspWithdrawal
      + nonRegTaxableGain
      + (isRetired ? nonRegDistribution : 0);

    // OAS clawback — based on net income (all taxable sources)
    const oasClawback = oasGross > 0 ? calculateOasClawback(taxableIncome, oasGross) : 0;
    const oasNet = oasGross - oasClawback;

    // GIS — for low-income retirees aged 65+
    // Net income for GIS excludes OAS but includes CPP, pension, RRSP withdrawals
    const incomeForGis = taxableIncome - oasGross; // GIS uses income excluding OAS
    const gisAmount = (isRetired && age >= 65) ? calculateGis(incomeForGis, hasSpouse) : 0;

    // Recalculate taxable income with net OAS
    // Note: The clawback is technically a repayment, but for income tax purposes,
    // the full OAS is included in income and the clawback is deducted on the return.
    // Net effect: taxable income stays the same, but you lose the OAS cash.

    // --- Pension income splitting ---
    // Eligible pension income: DB pension + RRIF withdrawals (if age 65+)
    // CPP and OAS are NOT eligible for pension splitting
    let pensionSplitSavings: number | undefined;
    let incomeTax: number;

    const isRrifAge = age > RRSP_TO_RRIF_AGE;
    const eligiblePensionIncome = pensionIncome
      + (isRetired && age >= 65 && isRrifAge ? rrspWithdrawal : 0);

    if (
      isRetired &&
      hasSpouse &&
      params.enablePensionSplitting &&
      eligiblePensionIncome > 0 &&
      (age >= 65 || isSpouseRetired)
    ) {
      // Estimate spouse's taxable income using actual CPP/OAS amounts
      const spouseTaxable = isSpouseRetired
        ? spouseCpp + spouseOasGross
        : spouseEmploymentIncome;

      const splitResult = optimizePensionSplit(
        taxableIncome,
        spouseTaxable,
        eligiblePensionIncome,
        client.province,
      );

      if (splitResult.taxSavings > 0) {
        pensionSplitSavings = Math.round(splitResult.taxSavings);
        const splitAmount = eligiblePensionIncome * (splitResult.splitPercentage / 100);
        // Tax on client's reduced taxable income
        incomeTax = estimateIncomeTax(taxableIncome - splitAmount, client.province);
      } else {
        incomeTax = estimateIncomeTax(taxableIncome, client.province);
      }
    } else {
      incomeTax = estimateIncomeTax(taxableIncome, client.province);
    }

    // Total cash received (OAS is reduced by clawback, GIS is tax-free)
    const totalIncome = employmentIncome + cpp + oasNet + gisAmount + pensionIncome
      + spouseEmploymentIncome + spouseCpp + spouseOasGross
      + rrspWithdrawal + tfsaWithdrawal + nonRegWithdrawal;

    const afterTaxIncome = totalIncome - incomeTax;
    const netCashFlow = afterTaxIncome - expenses;

    // Effective tax rate
    const effectiveTaxRate = totalIncome > 0 ? (incomeTax + oasClawback) / totalIncome : 0;

    // Net worth: balances + home - debts
    const homeValue = Math.round(
      client.primaryResidenceValue * Math.pow(1 + Math.min(params.inflationRate, 0.03), i),
    );
    const mortgageRate = client.mortgageRate ?? 0.05;
    const mortgageAmort = client.mortgageAmortizationYears ?? 25;
    const mortgageRemaining = calculateMortgageRemaining(client.mortgageBalance, mortgageRate, mortgageAmort, i);
    const netWorth = Math.round(rrspBalance) + Math.round(tfsaBalance)
      + Math.round(nonRegBalance) + Math.round(respBalance)
      + homeValue - mortgageRemaining
      - Math.max(0, client.otherDebts - (i * client.otherDebts / 10));

    rows.push({
      year,
      age,
      spouseAge,
      employmentIncome,
      spouseEmploymentIncome: hasSpouse ? spouseEmploymentIncome : undefined,
      cpp,
      oas: oasNet,
      oasClawback: oasClawback > 0 ? oasClawback : undefined,
      spouseCpp: hasSpouse && spouseCpp > 0 ? spouseCpp : undefined,
      spouseOas: hasSpouse && spouseOasGross > 0 ? spouseOasGross : undefined,
      gis: gisAmount > 0 ? gisAmount : undefined,
      pensionIncome,
      rrspRrifWithdrawals: rrspWithdrawal,
      rrifMinimumWithdrawal: rrifMinimumWithdrawal > 0 ? rrifMinimumWithdrawal : undefined,
      tfsaWithdrawals: tfsaWithdrawal,
      nonRegWithdrawals: nonRegWithdrawal,
      nonRegTaxableGain: nonRegTaxableGain > 0 ? nonRegTaxableGain : undefined,
      totalIncome,
      incomeTax,
      afterTaxIncome,
      expenses,
      netCashFlow,
      rrspRrifBalance: Math.round(rrspBalance),
      tfsaBalance: Math.round(tfsaBalance),
      fhsaBalance: Math.round(fhsaBalance),
      nonRegBalance: Math.round(nonRegBalance),
      nonRegAcb: Math.round(nonRegAcb),
      respBalance: Math.round(respBalance),
      netWorth: Math.round(netWorth),
      isRetired,
      effectiveTaxRate: Math.round(effectiveTaxRate * 10000) / 10000,
      pensionSplitSavings,
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Key metrics                                                        */
/* ------------------------------------------------------------------ */

export function calculateKeyMetrics(
  rows: ProjectionRow[],
  _params: ProjectionParams,
): KeyMetrics {
  if (rows.length === 0) {
    return {
      incomeReplacementRatio: 0,
      moneyLastsUntilAge: null,
      surplusAtAge95: null,
      totalLifetimeTax: 0,
      cppOasPercentOfRetirementIncome: 0,
      oasClawbackYears: 0,
      avgEffectiveTaxRate: 0,
      totalOasClawback: 0,
    };
  }

  // Find the first retirement year
  const retirementRow = rows.find((r) => r.isRetired);
  const lastPreRetirementRow = rows.filter((r) => !r.isRetired).pop();

  // Income replacement ratio
  const preRetirementIncome = lastPreRetirementRow?.afterTaxIncome ?? rows[0]?.afterTaxIncome ?? 0;
  const firstRetirementIncome = retirementRow?.afterTaxIncome ?? 0;
  const incomeReplacementRatio = preRetirementIncome > 0
    ? firstRetirementIncome / preRetirementIncome
    : 0;

  // Money lasts until age — find the first year where all investment balances are zero
  // and income can't cover expenses
  const depletedRow = rows.find(
    (r) =>
      r.isRetired &&
      r.rrspRrifBalance <= 0 &&
      r.tfsaBalance <= 0 &&
      r.nonRegBalance <= 0 &&
      r.netCashFlow < 0,
  );
  const moneyLastsUntilAge = depletedRow ? depletedRow.age : null;

  // Surplus at age 95
  const lastRow = rows[rows.length - 1];
  const surplusAtAge95 = lastRow
    ? lastRow.rrspRrifBalance + lastRow.tfsaBalance + lastRow.nonRegBalance
    : null;

  // Total lifetime tax
  const totalLifetimeTax = rows.reduce((sum, r) => sum + r.incomeTax, 0);

  // CPP + OAS as % of retirement income
  const retirementRows = rows.filter((r) => r.isRetired && r.totalIncome > 0);
  const avgCppOas =
    retirementRows.length > 0
      ? retirementRows.reduce((sum, r) => sum + r.cpp + r.oas, 0) / retirementRows.length
      : 0;
  const avgRetirementIncome =
    retirementRows.length > 0
      ? retirementRows.reduce((sum, r) => sum + r.totalIncome, 0) / retirementRows.length
      : 0;
  const cppOasPercentOfRetirementIncome =
    avgRetirementIncome > 0 ? avgCppOas / avgRetirementIncome : 0;

  // OAS clawback years — count years where clawback occurred
  const oasClawbackYears = rows.filter(
    (r) => r.oasClawback != null && r.oasClawback > 0,
  ).length;

  // Total OAS clawback — sum of all clawback amounts
  const totalOasClawback = rows.reduce(
    (sum, r) => sum + (r.oasClawback ?? 0),
    0,
  );

  // Average effective tax rate in retirement
  const retirementRowsWithIncome = retirementRows.filter((r) => r.totalIncome > 0);
  const avgEffectiveTaxRate =
    retirementRowsWithIncome.length > 0
      ? retirementRowsWithIncome.reduce(
          (sum, r) => sum + (r.effectiveTaxRate ?? 0),
          0,
        ) / retirementRowsWithIncome.length
      : 0;

  return {
    incomeReplacementRatio,
    moneyLastsUntilAge,
    surplusAtAge95,
    totalLifetimeTax,
    cppOasPercentOfRetirementIncome,
    oasClawbackYears,
    avgEffectiveTaxRate,
    totalOasClawback,
  };
}

/* ------------------------------------------------------------------ */
/*  CPP Estimator — estimate monthly CPP at 65 based on income         */
/* ------------------------------------------------------------------ */

/**
 * Rough estimate of CPP at age 65 based on current annual income.
 * CPP replacement rate is ~25% of pensionable earnings between
 * the basic exemption ($3,500) and the YMPE (~$71,300).
 * This is a simplified estimate — actual CPP depends on full contribution history.
 */
export function estimateCppMonthlyAt65(annualIncome: number): number {
  if (annualIncome <= CPP_BASIC_EXEMPTION) return 0;
  const pensionableEarnings = Math.min(annualIncome, CPP_YMPE_2025) - CPP_BASIC_EXEMPTION;
  const maxPensionableEarnings = CPP_YMPE_2025 - CPP_BASIC_EXEMPTION;
  // CPP max at 65 is ~$1,364.60/month
  const ratio = pensionableEarnings / maxPensionableEarnings;
  return Math.round(CPP_MAX_MONTHLY_2025 * ratio);
}
