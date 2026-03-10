import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value === 0) return '$0';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyDetailed(value: number): string {
  if (value === 0) return '$0.00';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Present value of an annuity: PMT * [(1 - (1+r)^-n) / r]
 * If r === 0, just returns PMT * n.
 */
function pvAnnuity(annualPayment: number, rate: number, years: number): number {
  if (years <= 0) return 0;
  if (rate === 0) return annualPayment * years;
  return annualPayment * ((1 - Math.pow(1 + rate, -years)) / rate);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-card-border bg-white p-6 shadow-sm ${className}`}
    >
      {title && (
        <h3 className="font-serif text-lg text-navy tracking-wide mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

function Field({ label, hint, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text-primary mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy focus:ring-2 focus:ring-navy/20 focus:outline-none transition-colors';

// ---------------------------------------------------------------------------
// Result Card
// ---------------------------------------------------------------------------

function ResultCard({
  title,
  amount,
  subtitle,
  variant,
}: {
  title: string;
  amount: number;
  subtitle: string;
  variant: 'positive' | 'warning' | 'danger';
}) {
  const colorMap = {
    positive: {
      bg: 'bg-positive/10 border-positive/20',
      text: 'text-positive',
      label: 'Adequately covered',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-600',
      label: 'Gap identified',
    },
    danger: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-600',
      label: 'Coverage needed',
    },
  };

  const colors = colorMap[variant];

  return (
    <div className={`rounded-xl border p-6 ${colors.bg}`}>
      <p className="text-sm font-medium text-text-secondary mb-1">{title}</p>
      <p className={`text-3xl font-bold tabular-nums ${colors.text}`}>
        {formatCurrency(Math.abs(amount))}
      </p>
      <p className="text-sm text-text-secondary mt-2">{subtitle}</p>
      <span
        className={`inline-block mt-3 text-xs font-medium px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}
      >
        {amount <= 0 ? colorMap.positive.label : colors.label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function InsuranceNeeds() {
  const { currentClient } = useAppStore();

  // Adjustable parameters
  const [dependentChildren, setDependentChildren] = useState(0);
  const [educationCostPerChild, setEducationCostPerChild] = useState(25000);
  const [incomeReplacementRatio, setIncomeReplacementRatio] = useState(70);
  const [yearsOverride, setYearsOverride] = useState<number | null>(null);
  const [finalExpenses, setFinalExpenses] = useState(15000);
  const [existingDisabilityMonthly, setExistingDisabilityMonthly] = useState(0);
  const [existingCriticalIllness, setExistingCriticalIllness] = useState(0);
  const [inputsExpanded, setInputsExpanded] = useState(true);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);

  // Guard: no client loaded
  if (!currentClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary text-sm">
          No client loaded. Please select or create a client first.
        </p>
      </div>
    );
  }

  const c = currentClient;

  // Derive values from client data
  const clientAge = calculateAge(c.dateOfBirth);
  const spouseAge = c.hasSpouse && c.spouse?.dateOfBirth
    ? calculateAge(c.spouse.dateOfBirth)
    : null;

  // Auto-calculate years of income replacement
  const autoYears = useMemo(() => {
    if (c.hasSpouse && spouseAge !== null && c.spouse?.targetRetirementAge) {
      const yearsUntilSpouseRetirement =
        c.spouse.targetRetirementAge - spouseAge;
      return Math.max(1, yearsUntilSpouseRetirement);
    }
    return 20;
  }, [c.hasSpouse, spouseAge, c.spouse?.targetRetirementAge]);

  const yearsOfReplacement = yearsOverride ?? autoYears;

  // ---------------------------------------------------------------------------
  // Life Insurance Calculation
  // ---------------------------------------------------------------------------

  const lifeCalc = useMemo(() => {
    const annualReplacement =
      c.annualIncome * (incomeReplacementRatio / 100);
    const netDiscountRate = 0.02; // investment return minus inflation
    const incomeReplacementPV = pvAnnuity(
      annualReplacement,
      netDiscountRate,
      yearsOfReplacement
    );

    const mortgagePayoff = c.mortgageBalance;
    const otherDebts = c.otherDebts;
    const educationFund = dependentChildren * educationCostPerChild;
    const finalExp = finalExpenses;

    const totalNeed =
      incomeReplacementPV +
      mortgagePayoff +
      otherDebts +
      educationFund +
      finalExp;

    const existingLife =
      c.hasLifeInsurance && c.lifeInsuranceDetails
        ? c.lifeInsuranceDetails.coverageAmount
        : 0;
    const liquidAssets = c.tfsaBalance + c.nonRegisteredInvestments;

    const netNeed = totalNeed - existingLife - liquidAssets;

    return {
      annualReplacement,
      incomeReplacementPV,
      mortgagePayoff,
      otherDebts,
      educationFund,
      finalExpenses: finalExp,
      totalNeed,
      existingLife,
      liquidAssets,
      netNeed: Math.max(0, netNeed),
      rawNetNeed: netNeed,
    };
  }, [
    c.annualIncome,
    c.mortgageBalance,
    c.otherDebts,
    c.hasLifeInsurance,
    c.lifeInsuranceDetails,
    c.tfsaBalance,
    c.nonRegisteredInvestments,
    incomeReplacementRatio,
    yearsOfReplacement,
    dependentChildren,
    educationCostPerChild,
    finalExpenses,
  ]);

  // ---------------------------------------------------------------------------
  // Disability Insurance Calculation
  // ---------------------------------------------------------------------------

  const disabilityCalc = useMemo(() => {
    const monthlyNeed = (c.annualIncome * 0.6) / 12;
    const monthlyExisting = existingDisabilityMonthly;
    const monthlyGap = Math.max(0, monthlyNeed - monthlyExisting);

    return {
      monthlyNeed,
      monthlyExisting,
      monthlyGap,
      rawGap: monthlyNeed - monthlyExisting,
    };
  }, [c.annualIncome, existingDisabilityMonthly]);

  // ---------------------------------------------------------------------------
  // Critical Illness Calculation
  // ---------------------------------------------------------------------------

  const criticalCalc = useMemo(() => {
    const recommended = c.annualIncome * 2;
    const existing = existingCriticalIllness;
    const gap = Math.max(0, recommended - existing);

    return {
      recommended,
      existing,
      gap,
      rawGap: recommended - existing,
    };
  }, [c.annualIncome, existingCriticalIllness]);

  // ---------------------------------------------------------------------------
  // Result card variants
  // ---------------------------------------------------------------------------

  const lifeVariant =
    lifeCalc.rawNetNeed <= 0
      ? 'positive'
      : lifeCalc.netNeed > c.annualIncome * 3
      ? 'danger'
      : 'warning';

  const disabilityVariant =
    disabilityCalc.rawGap <= 0
      ? 'positive'
      : disabilityCalc.monthlyGap > 2000
      ? 'danger'
      : 'warning';

  const criticalVariant =
    criticalCalc.rawGap <= 0
      ? 'positive'
      : criticalCalc.gap > c.annualIncome
      ? 'danger'
      : 'warning';

  // ---------------------------------------------------------------------------
  // Recommendations
  // ---------------------------------------------------------------------------

  const recommendations = useMemo(() => {
    const recs: { type: 'life' | 'disability' | 'critical'; text: string }[] =
      [];

    if (lifeCalc.rawNetNeed > 0) {
      recs.push({
        type: 'life',
        text: `Consider ${formatCurrency(lifeCalc.netNeed)} of term life insurance to close the coverage gap. This accounts for income replacement, debt payoff, education funding, and final expenses, less existing coverage and liquid assets.`,
      });
    }

    if (disabilityCalc.rawGap > 0) {
      recs.push({
        type: 'disability',
        text: `Income protection gap of ${formatCurrencyDetailed(disabilityCalc.monthlyGap)}/month identified. Consider a disability insurance policy that replaces 60% of pre-disability income${
          c.hasDisabilityInsurance
            ? ', supplementing existing coverage'
            : ''
        }.`,
      });
    }

    if (criticalCalc.rawGap > 0) {
      recs.push({
        type: 'critical',
        text: `Consider critical illness coverage of ${formatCurrency(criticalCalc.gap)}. A lump-sum benefit upon diagnosis covers income loss and out-of-pocket medical expenses not covered by provincial health plans.`,
      });
    }

    return recs;
  }, [lifeCalc, disabilityCalc, criticalCalc, c.hasDisabilityInsurance]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-navy tracking-wide">
          Insurance Needs Analysis
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {c.firstName && c.lastName
            ? `${c.firstName} ${c.lastName}`
            : 'Current Client'}{' '}
          &mdash; Capital needs analysis for life, disability, and critical
          illness coverage
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Input Section */}
      {/* ----------------------------------------------------------------- */}
      <Card className="mb-6">
        <button
          type="button"
          onClick={() => setInputsExpanded(!inputsExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-serif text-lg text-navy tracking-wide">
            Analysis Parameters
          </h3>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-5 h-5 text-text-secondary transition-transform ${
              inputsExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {inputsExpanded && (
          <div className="mt-6 pt-4 border-t border-card-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Dependent Children */}
              <Field label="Number of Dependent Children">
                <select
                  value={dependentChildren}
                  onChange={(e) =>
                    setDependentChildren(parseInt(e.target.value, 10))
                  }
                  className={inputClass}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Education Cost Per Child */}
              <Field
                label="Education Cost per Child"
                hint="Post-secondary education funding"
              >
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={educationCostPerChild}
                  onChange={(e) =>
                    setEducationCostPerChild(
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className={inputClass}
                />
              </Field>

              {/* Income Replacement Ratio */}
              <Field
                label={`Income Replacement Ratio: ${incomeReplacementRatio}%`}
                hint="Percentage of income to replace"
              >
                <input
                  type="range"
                  min={60}
                  max={80}
                  step={5}
                  value={incomeReplacementRatio}
                  onChange={(e) =>
                    setIncomeReplacementRatio(parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-navy"
                />
                <div className="flex justify-between text-xs text-text-secondary mt-1">
                  <span>60%</span>
                  <span>80%</span>
                </div>
              </Field>

              {/* Years of Income Replacement */}
              <Field
                label="Years of Income Replacement"
                hint={
                  yearsOverride === null
                    ? c.hasSpouse
                      ? `Auto: ${autoYears} yrs (spouse retirement)`
                      : `Auto: ${autoYears} yrs (default)`
                    : 'Manual override'
                }
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={30}
                    value={yearsOverride ?? autoYears}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val >= 10 && val <= 30) {
                        setYearsOverride(val);
                      }
                    }}
                    className={inputClass}
                  />
                  {yearsOverride !== null && (
                    <button
                      type="button"
                      onClick={() => setYearsOverride(null)}
                      className="text-xs text-accent hover:text-accent-light whitespace-nowrap"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </Field>

              {/* Final Expenses */}
              <Field
                label="Final Expenses"
                hint="Funeral costs, estate settlement"
              >
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={finalExpenses}
                  onChange={(e) =>
                    setFinalExpenses(parseInt(e.target.value, 10) || 0)
                  }
                  className={inputClass}
                />
              </Field>

              {/* Existing Disability Monthly Benefit */}
              <Field
                label="Existing Disability Monthly Benefit"
                hint={
                  c.hasDisabilityInsurance
                    ? 'Client reports having disability coverage'
                    : 'No disability coverage on file'
                }
              >
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={existingDisabilityMonthly}
                  onChange={(e) =>
                    setExistingDisabilityMonthly(
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className={inputClass}
                />
              </Field>

              {/* Existing Critical Illness Coverage */}
              <Field
                label="Existing Critical Illness Coverage"
                hint={
                  c.hasCriticalIllness
                    ? 'Client reports having CI coverage'
                    : 'No CI coverage on file'
                }
              >
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={existingCriticalIllness}
                  onChange={(e) =>
                    setExistingCriticalIllness(
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Client data summary */}
            <div className="mt-5 pt-4 border-t border-card-border">
              <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
                Pre-populated from client profile
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-text-secondary">Annual Income:</span>{' '}
                  <span className="font-medium text-text-primary">
                    {formatCurrency(c.annualIncome)}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Mortgage:</span>{' '}
                  <span className="font-medium text-text-primary">
                    {formatCurrency(c.mortgageBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Other Debts:</span>{' '}
                  <span className="font-medium text-text-primary">
                    {formatCurrency(c.otherDebts)}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Life Insurance:</span>{' '}
                  <span className="font-medium text-text-primary">
                    {c.hasLifeInsurance
                      ? formatCurrency(
                          c.lifeInsuranceDetails?.coverageAmount ?? 0
                        )
                      : 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">TFSA:</span>{' '}
                  <span className="font-medium text-text-primary">
                    {formatCurrency(c.tfsaBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Non-Reg:</span>{' '}
                  <span className="font-medium text-text-primary">
                    {formatCurrency(c.nonRegisteredInvestments)}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Spouse:</span>{' '}
                  <span className="font-medium text-text-primary">
                    {c.hasSpouse ? 'Yes' : 'No'}
                  </span>
                </div>
                {clientAge !== null && (
                  <div>
                    <span className="text-text-secondary">Client Age:</span>{' '}
                    <span className="font-medium text-text-primary">
                      {clientAge}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Results Dashboard */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ResultCard
          title="Life Insurance Need"
          amount={lifeCalc.rawNetNeed}
          subtitle={
            lifeCalc.rawNetNeed <= 0
              ? 'Current coverage and assets exceed calculated need'
              : `Gap after existing coverage of ${formatCurrency(lifeCalc.existingLife)} and ${formatCurrency(lifeCalc.liquidAssets)} in liquid assets`
          }
          variant={lifeVariant}
        />
        <ResultCard
          title="Disability Insurance Need"
          amount={disabilityCalc.rawGap}
          subtitle={
            disabilityCalc.rawGap <= 0
              ? 'Monthly disability coverage is sufficient'
              : `${formatCurrencyDetailed(disabilityCalc.monthlyNeed)}/mo needed, ${formatCurrencyDetailed(disabilityCalc.monthlyExisting)}/mo covered`
          }
          variant={disabilityVariant}
        />
        <ResultCard
          title="Critical Illness Need"
          amount={criticalCalc.rawGap}
          subtitle={
            criticalCalc.rawGap <= 0
              ? 'Critical illness coverage is adequate'
              : `${formatCurrency(criticalCalc.recommended)} recommended (2x income)`
          }
          variant={criticalVariant}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Detailed Breakdown */}
      {/* ----------------------------------------------------------------- */}
      <Card className="mb-6">
        <button
          type="button"
          onClick={() => setBreakdownExpanded(!breakdownExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-serif text-lg text-navy tracking-wide">
            Detailed Life Insurance Breakdown
          </h3>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-5 h-5 text-text-secondary transition-transform ${
              breakdownExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {breakdownExpanded && (
          <div className="mt-6 pt-4 border-t border-card-border">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-card-border">
                  <td className="py-3 text-text-secondary">
                    Income Replacement (PV)
                    <span className="block text-xs text-text-secondary/70 mt-0.5">
                      {formatCurrency(lifeCalc.annualReplacement)}/yr x{' '}
                      {yearsOfReplacement} yrs @ 2% net discount rate
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium text-text-primary tabular-nums">
                    {formatCurrency(lifeCalc.incomeReplacementPV)}
                  </td>
                </tr>
                <tr className="border-b border-card-border">
                  <td className="py-3 text-text-secondary">Mortgage Payoff</td>
                  <td className="py-3 text-right font-medium text-text-primary tabular-nums">
                    {formatCurrency(lifeCalc.mortgagePayoff)}
                  </td>
                </tr>
                <tr className="border-b border-card-border">
                  <td className="py-3 text-text-secondary">
                    Other Debt Payoff
                  </td>
                  <td className="py-3 text-right font-medium text-text-primary tabular-nums">
                    {formatCurrency(lifeCalc.otherDebts)}
                  </td>
                </tr>
                <tr className="border-b border-card-border">
                  <td className="py-3 text-text-secondary">
                    Education Fund
                    <span className="block text-xs text-text-secondary/70 mt-0.5">
                      {dependentChildren} child(ren) x{' '}
                      {formatCurrency(educationCostPerChild)}
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium text-text-primary tabular-nums">
                    {formatCurrency(lifeCalc.educationFund)}
                  </td>
                </tr>
                <tr className="border-b border-card-border">
                  <td className="py-3 text-text-secondary">Final Expenses</td>
                  <td className="py-3 text-right font-medium text-text-primary tabular-nums">
                    {formatCurrency(lifeCalc.finalExpenses)}
                  </td>
                </tr>
                <tr className="border-b-2 border-navy/20 bg-bg-secondary/50">
                  <td className="py-3 px-2 font-semibold text-navy">
                    Total Need
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-navy tabular-nums">
                    {formatCurrency(lifeCalc.totalNeed)}
                  </td>
                </tr>
                <tr className="border-b border-card-border">
                  <td className="py-3 text-text-secondary">
                    Less: Existing Life Insurance
                  </td>
                  <td className="py-3 text-right font-medium text-positive tabular-nums">
                    ({formatCurrency(lifeCalc.existingLife)})
                  </td>
                </tr>
                <tr className="border-b border-card-border">
                  <td className="py-3 text-text-secondary">
                    Less: Liquid Assets (TFSA + Non-Reg)
                    <span className="block text-xs text-text-secondary/70 mt-0.5">
                      RRSP excluded due to tax on withdrawal
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium text-positive tabular-nums">
                    ({formatCurrency(lifeCalc.liquidAssets)})
                  </td>
                </tr>
                <tr className="bg-navy/5">
                  <td className="py-4 px-2 font-bold text-navy text-base">
                    Net Insurance Need
                  </td>
                  <td
                    className={`py-4 px-2 text-right font-bold text-base tabular-nums ${
                      lifeCalc.rawNetNeed <= 0 ? 'text-positive' : 'text-red-600'
                    }`}
                  >
                    {lifeCalc.rawNetNeed <= 0
                      ? `Surplus of ${formatCurrency(Math.abs(lifeCalc.rawNetNeed))}`
                      : formatCurrency(lifeCalc.netNeed)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Disability & CI detail */}
            <div className="mt-6 pt-4 border-t border-card-border grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-navy mb-3">
                  Disability Insurance Detail
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      60% of Income (monthly)
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrencyDetailed(disabilityCalc.monthlyNeed)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      Existing Coverage
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrencyDetailed(disabilityCalc.monthlyExisting)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-card-border">
                    <span className="font-semibold text-navy">
                      Monthly Gap
                    </span>
                    <span
                      className={`font-bold tabular-nums ${
                        disabilityCalc.rawGap <= 0
                          ? 'text-positive'
                          : 'text-red-600'
                      }`}
                    >
                      {disabilityCalc.rawGap <= 0
                        ? 'Covered'
                        : formatCurrencyDetailed(disabilityCalc.monthlyGap)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-navy mb-3">
                  Critical Illness Detail
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      Recommended (2x income)
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(criticalCalc.recommended)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      Existing Coverage
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(criticalCalc.existing)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-card-border">
                    <span className="font-semibold text-navy">
                      Lump Sum Gap
                    </span>
                    <span
                      className={`font-bold tabular-nums ${
                        criticalCalc.rawGap <= 0
                          ? 'text-positive'
                          : 'text-red-600'
                      }`}
                    >
                      {criticalCalc.rawGap <= 0
                        ? 'Covered'
                        : formatCurrency(criticalCalc.gap)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Recommendations */}
      {/* ----------------------------------------------------------------- */}
      {recommendations.length > 0 ? (
        <Card title="Recommendations">
          <div className="space-y-4">
            {recommendations.map((rec, i) => {
              const iconColor =
                rec.type === 'life'
                  ? 'text-red-500'
                  : rec.type === 'disability'
                  ? 'text-amber-500'
                  : 'text-orange-500';

              return (
                <div
                  key={i}
                  className="flex gap-3 p-4 rounded-lg bg-bg-secondary border border-card-border"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {rec.text}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-3 p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-positive shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-positive">
                All insurance needs are covered
              </p>
              <p className="text-sm text-text-secondary mt-0.5">
                Current coverage and assets are sufficient based on the analysis
                parameters above.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-text-secondary mt-6 text-center">
        This analysis is for illustrative purposes only and does not constitute
        insurance advice. Actual insurance needs may vary based on individual
        circumstances, health status, and underwriting requirements.
      </p>
    </div>
  );
}
