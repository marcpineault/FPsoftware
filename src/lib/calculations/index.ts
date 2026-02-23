import type { Client, ProjectionRow, KeyMetrics, ProjectionParams } from '../types';

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

/** Simplified Canadian federal + provincial income tax (Ontario baseline) */
function estimateIncomeTax(taxableIncome: number, province: string): number {
  if (taxableIncome <= 0) return 0;

  // Federal brackets (2025 approximation)
  const federalBrackets = [
    { limit: 55867, rate: 0.15 },
    { limit: 111733, rate: 0.205 },
    { limit: 154906, rate: 0.26 },
    { limit: 220000, rate: 0.29 },
    { limit: Infinity, rate: 0.33 },
  ];

  // Basic personal amount (federal)
  const bpa = 15705;
  const federalTaxableIncome = Math.max(0, taxableIncome - bpa);

  let federalTax = 0;
  let remaining = federalTaxableIncome;
  let prevLimit = 0;

  for (const bracket of federalBrackets) {
    const taxable = Math.min(remaining, bracket.limit - prevLimit);
    if (taxable <= 0) break;
    federalTax += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
  }

  // Provincial tax rates (simplified, Ontario as default)
  const provincialRates: Record<string, number> = {
    AB: 0.10, BC: 0.0506, MB: 0.108, NB: 0.094, NL: 0.087,
    NS: 0.0879, NT: 0.059, NU: 0.04, ON: 0.0505, PE: 0.098,
    QC: 0.14, SK: 0.105, YT: 0.064,
  };

  const provRate = provincialRates[province] ?? 0.0505;
  const provincialTax = Math.max(0, taxableIncome - 11141) * provRate;

  return Math.round(federalTax + provincialTax);
}

/**
 * Estimate CPP monthly benefit at age 65 given pensionable earnings,
 * then adjust for early/late take.
 */
function calculateCppAnnual(
  estimatedMonthlyAt65: number,
  startAge: number,
): number {
  // CPP adjustment: -0.6% per month before 65, +0.7% per month after 65
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
 * Estimate OAS annual benefit. Standard OAS ~$8,000/yr at 65.
 * Deferral bonus: +0.6% per month of deferral (max age 70).
 */
function calculateOasAnnual(startAge: number): number {
  const baseAnnual = 8500; // approximate 2025 OAS
  const monthsDeferred = Math.max(0, Math.min(startAge - 65, 5)) * 12;
  const adjustment = 1 + monthsDeferred * 0.006;
  return Math.round(baseAnnual * adjustment);
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

  // Pension income (DB or DC)
  const hasPension = client.pensionType !== 'none';
  const pensionAnnualBenefit = client.pensionDetails?.annualBenefitEstimate ?? 0;

  // Current annual spending
  const currentAnnualSpending = client.monthlyExpenses * 12;
  const retirementSpending = currentAnnualSpending * params.retirementSpendingRate;

  // CPP and OAS annual amounts
  const cppAnnual = calculateCppAnnual(params.estimatedCppMonthly, params.cppStartAge);
  const oasAnnual = calculateOasAnnual(params.oasStartAge);

  for (let i = 0; i < totalYears; i++) {
    const year = currentYear + i;
    const age = currentAge + i;
    const isRetired = age >= params.retirementAge;

    // Inflation factor from current year
    const inflationFactor = Math.pow(1 + params.inflationRate, i);

    // --- Income sources ---

    // Employment income (grows with inflation until retirement)
    const employmentIncome = isRetired
      ? 0
      : Math.round(client.annualIncome * Math.pow(1 + Math.min(params.inflationRate, 0.03), i));

    // CPP (starts at cppStartAge, inflation-indexed)
    const cpp = age >= params.cppStartAge ? Math.round(cppAnnual * inflationFactor) : 0;

    // OAS (starts at oasStartAge, inflation-indexed)
    const oas = age >= params.oasStartAge ? Math.round(oasAnnual * inflationFactor) : 0;

    // Pension income (starts at retirement, inflation-indexed)
    const pensionIncome = isRetired && hasPension
      ? Math.round(pensionAnnualBenefit * inflationFactor)
      : 0;

    // --- Pre-retirement: grow balances with contributions ---
    if (!isRetired) {
      rrspBalance = rrspBalance * (1 + params.rrspReturnRate) + client.rrspAnnualContribution;
      tfsaBalance = tfsaBalance * (1 + params.tfsaReturnRate) + client.tfsaAnnualContribution;
      nonRegBalance = nonRegBalance * (1 + params.nonRegReturnRate);
    }

    // --- Expenses ---
    const expenses = isRetired
      ? Math.round(retirementSpending * inflationFactor)
      : Math.round(currentAnnualSpending * inflationFactor);

    // --- Calculate withdrawal needs in retirement ---
    let rrspWithdrawal = 0;
    let tfsaWithdrawal = 0;
    let nonRegWithdrawal = 0;

    if (isRetired) {
      // Guaranteed income
      const guaranteedIncome = cpp + oas + pensionIncome;

      // Shortfall that needs to be covered by withdrawals
      // We estimate tax on guaranteed income first, then figure out gross needed
      const estimatedTaxOnGuaranteed = estimateIncomeTax(guaranteedIncome, client.province);
      const afterTaxGuaranteed = guaranteedIncome - estimatedTaxOnGuaranteed;
      const shortfall = Math.max(0, expenses - afterTaxGuaranteed);

      if (shortfall > 0) {
        // Gross-up for tax (RRSP withdrawals are taxable)
        const grossNeeded = shortfall * 1.3; // rough gross-up

        // Withdrawal order: RRSP/RRIF first, then non-reg, then TFSA (tax-free last)
        if (rrspBalance > 0) {
          rrspWithdrawal = Math.min(rrspBalance, grossNeeded);
          rrspBalance = Math.max(0, rrspBalance - rrspWithdrawal);
        }

        const remainingNeeded = grossNeeded - rrspWithdrawal;

        if (remainingNeeded > 0 && nonRegBalance > 0) {
          nonRegWithdrawal = Math.min(nonRegBalance, remainingNeeded);
          nonRegBalance = Math.max(0, nonRegBalance - nonRegWithdrawal);
        }

        const stillNeeded = remainingNeeded - nonRegWithdrawal;

        if (stillNeeded > 0 && tfsaBalance > 0) {
          tfsaWithdrawal = Math.min(tfsaBalance, stillNeeded);
          tfsaBalance = Math.max(0, tfsaBalance - tfsaWithdrawal);
        }
      }

      // Grow remaining balances
      rrspBalance = rrspBalance * (1 + params.rrspReturnRate);
      tfsaBalance = tfsaBalance * (1 + params.tfsaReturnRate);
      nonRegBalance = nonRegBalance * (1 + params.nonRegReturnRate);
    }

    // Round balances
    rrspWithdrawal = Math.round(rrspWithdrawal);
    tfsaWithdrawal = Math.round(tfsaWithdrawal);
    nonRegWithdrawal = Math.round(nonRegWithdrawal);

    // Total income
    const totalIncome = employmentIncome + cpp + oas + pensionIncome
      + rrspWithdrawal + tfsaWithdrawal + nonRegWithdrawal;

    // Taxable income (TFSA withdrawals are not taxable)
    const taxableIncome = totalIncome - tfsaWithdrawal;
    const incomeTax = estimateIncomeTax(taxableIncome, client.province);
    const afterTaxIncome = totalIncome - incomeTax;
    const netCashFlow = afterTaxIncome - expenses;

    // Net worth: balances + home - debts (simplified)
    const homeValue = Math.round(
      client.primaryResidenceValue * Math.pow(1 + Math.min(params.inflationRate, 0.03), i),
    );
    const mortgageRemaining = Math.max(0, client.mortgageBalance - (i * client.mortgageBalance / 25));
    const netWorth = Math.round(rrspBalance) + Math.round(tfsaBalance)
      + Math.round(nonRegBalance) + homeValue - Math.round(mortgageRemaining)
      - Math.max(0, client.otherDebts - (i * client.otherDebts / 10));

    rows.push({
      year,
      age,
      employmentIncome,
      cpp,
      oas,
      pensionIncome,
      rrspRrifWithdrawals: rrspWithdrawal,
      tfsaWithdrawals: tfsaWithdrawal,
      nonRegWithdrawals: nonRegWithdrawal,
      totalIncome,
      incomeTax,
      afterTaxIncome,
      expenses,
      netCashFlow,
      rrspRrifBalance: Math.round(rrspBalance),
      tfsaBalance: Math.round(tfsaBalance),
      nonRegBalance: Math.round(nonRegBalance),
      netWorth: Math.round(netWorth),
      isRetired,
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

  return {
    incomeReplacementRatio,
    moneyLastsUntilAge,
    surplusAtAge95,
    totalLifetimeTax,
    cppOasPercentOfRetirementIncome,
  };
}
