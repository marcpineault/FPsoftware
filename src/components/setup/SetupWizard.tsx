import { useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../../store';
import { PROVINCE_NAMES } from '../../lib/constants';
import { estimateCppMonthlyAt65 } from '../../lib/calculations';
import type {
  CanadianProvince,
  EmploymentStatus,
  InsuranceType,
  InsuranceSource,
  Client,
} from '../../lib/types';
import { CurrencyInput, Input } from '../shared/Input';
import { Select } from '../shared/Select';
import { Toggle } from '../shared/Toggle';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 'client', label: 'Client' },
  { id: 'income', label: 'Income & Employment' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'assets', label: 'Assets' },
  { id: 'debts', label: 'Debts & Property' },
  { id: 'benefits', label: "Gov't Benefits" },
  { id: 'insurance', label: 'Insurance' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// Province options for select
const PROVINCE_OPTIONS = Object.entries(PROVINCE_NAMES).map(([value, label]) => ({
  value,
  label,
}));

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Employed' },
  { value: 'self-employed', label: 'Self-Employed' },
  { value: 'retired', label: 'Retired' },
  { value: 'other', label: 'Other' },
];

const PENSION_OPTIONS = [
  { value: 'none', label: 'No Pension' },
  { value: 'db', label: 'Defined Benefit' },
  { value: 'dc', label: 'Defined Contribution' },
];

const INSURANCE_TYPE_OPTIONS = [
  { value: 'term', label: 'Term' },
  { value: 'whole', label: 'Whole Life' },
  { value: 'universal', label: 'Universal Life' },
];

const INSURANCE_SOURCE_OPTIONS = [
  { value: 'employer', label: 'Employer' },
  { value: 'personal', label: 'Personal' },
  { value: 'both', label: 'Both' },
];

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

function FieldRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : cols === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-text-primary mt-6 mb-3 first:mt-0">{children}</h3>;
}

function SectionDivider() {
  return <hr className="my-6 border-gray-200" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SetupWizard() {
  const { id, step: rawStep } = useParams<{ id: string; step?: string }>();
  const navigate = useNavigate();
  const { currentClient, updateClient } = useAppStore();

  const step: StepId = (rawStep as StepId) || 'client';
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  // Auto-save field change
  const handleField = useCallback(
    (field: keyof Client, value: Client[keyof Client]) => {
      if (!currentClient) return;
      updateClient({ [field]: value });
    },
    [currentClient, updateClient],
  );

  // Nested field change for projectionParams
  const handleParam = useCallback(
    (field: string, value: number | boolean) => {
      if (!currentClient) return;
      updateClient({
        projectionParams: { ...currentClient.projectionParams, [field]: value },
      });
    },
    [currentClient, updateClient],
  );

  // Spouse field change
  const handleSpouseField = useCallback(
    (field: string, value: string | number) => {
      if (!currentClient) return;
      const spouse = currentClient.spouse || {
        firstName: '', lastName: '', dateOfBirth: '',
        employmentStatus: 'employed' as EmploymentStatus,
        annualIncome: 0, targetRetirementAge: 65,
        estimatedCppMonthly: 0, cppStartAge: 65, oasStartAge: 65,
        rrspBalance: 0, spousalRrspBalance: 0, tfsaBalance: 0,
      };
      updateClient({ spouse: { ...spouse, [field]: value } });
    },
    [currentClient, updateClient],
  );

  // Insurance details change
  const handleInsuranceDetail = useCallback(
    (field: string, value: string | number) => {
      if (!currentClient) return;
      const details = currentClient.lifeInsuranceDetails || {
        coverageAmount: 0, type: 'term' as InsuranceType, source: 'personal' as InsuranceSource,
      };
      updateClient({ lifeInsuranceDetails: { ...details, [field]: value } });
    },
    [currentClient, updateClient],
  );

  // Pension details change
  const handlePensionDetail = useCallback(
    (field: string, value: number) => {
      if (!currentClient) return;
      const details = currentClient.pensionDetails || {
        annualBenefitEstimate: 0, currentBalance: 0, annualContribution: 0,
      };
      updateClient({ pensionDetails: { ...details, [field]: value } });
    },
    [currentClient, updateClient],
  );

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      navigate(`/client/${id}/setup/${STEPS[currentStepIndex + 1].id}`);
    } else {
      // After last setup step, go to projections
      navigate(`/client/${id}/projections`);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      navigate(`/client/${id}/setup/${STEPS[currentStepIndex - 1].id}`);
    }
  };

  if (!currentClient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const c = currentClient;

  return (
    <div className="flex h-full">
      {/* Step sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 py-4 overflow-y-auto hidden md:block">
        <div className="px-3 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium px-3">Setup Steps</p>
        </div>
        <nav className="space-y-0.5 px-3">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const visited = i < currentStepIndex;
            return (
              <Link
                key={s.id}
                to={`/client/${id}/setup/${s.id}`}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                  ${active
                    ? 'bg-accent/10 text-accent font-medium'
                    : visited
                    ? 'text-text-secondary hover:bg-gray-50'
                    : 'text-text-tertiary hover:bg-gray-50 hover:text-text-secondary'
                  }
                `}
              >
                <span
                  className={`
                    flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0
                    ${active
                      ? 'bg-accent text-white'
                      : visited
                      ? 'bg-positive/20 text-positive'
                      : 'bg-gray-100 text-text-tertiary'
                    }
                  `}
                >
                  {visited && !active ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span>{s.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Step content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile step indicator */}
        <div className="md:hidden px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-2">
          <span className="text-xs text-text-tertiary">Step {currentStepIndex + 1} of {STEPS.length}:</span>
          <span className="text-sm font-medium text-text-primary">{STEPS[currentStepIndex].label}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Step title */}
            <h2 className="text-xl font-semibold text-text-primary mb-1">
              {STEPS[currentStepIndex].label}
            </h2>
            <p className="text-sm text-text-tertiary mb-6">
              {step === 'client' && 'Basic client information.'}
              {step === 'income' && 'Employment and income details.'}
              {step === 'expenses' && 'Monthly and annual expenses.'}
              {step === 'assets' && 'Registered and non-registered accounts.'}
              {step === 'debts' && 'Mortgage, property, and other debts.'}
              {step === 'benefits' && 'CPP, OAS, and pension information.'}
              {step === 'insurance' && 'Life, disability, and critical illness coverage.'}
            </p>

            {/* Step forms */}
            <div className="space-y-4">
              {step === 'client' && (
                <>
                  <FieldRow>
                    <Input
                      label="First Name"
                      value={c.firstName}
                      onChange={(e) => handleField('firstName', e.target.value)}
                      placeholder="John"
                    />
                    <Input
                      label="Last Name"
                      value={c.lastName}
                      onChange={(e) => handleField('lastName', e.target.value)}
                      placeholder="Smith"
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="Date of Birth"
                      type="date"
                      value={c.dateOfBirth}
                      onChange={(e) => handleField('dateOfBirth', e.target.value)}
                    />
                    <Select
                      label="Province"
                      value={c.province}
                      onChange={(e) => handleField('province', e.target.value as CanadianProvince)}
                      options={PROVINCE_OPTIONS}
                    />
                  </FieldRow>
                </>
              )}

              {step === 'income' && (
                <>
                  <FieldRow>
                    <Select
                      label="Employment Status"
                      value={c.employmentStatus}
                      onChange={(e) => handleField('employmentStatus', e.target.value as EmploymentStatus)}
                      options={EMPLOYMENT_OPTIONS}
                    />
                    <CurrencyInput
                      label="Annual Income"
                      value={c.annualIncome}
                      onValueChange={(v) => handleField('annualIncome', v)}
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="Target Retirement Age"
                      type="number"
                      min={50}
                      max={75}
                      value={c.targetRetirementAge || ''}
                      onChange={(e) => handleField('targetRetirementAge', parseInt(e.target.value) || 65)}
                    />
                  </FieldRow>

                  <SectionDivider />

                  <Toggle
                    label="Has Spouse / Partner"
                    checked={c.hasSpouse}
                    onChange={(v) => handleField('hasSpouse', v)}
                  />

                  {c.hasSpouse && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      <SectionTitle>Spouse Details</SectionTitle>
                      <FieldRow>
                        <Input
                          label="First Name"
                          value={c.spouse?.firstName || ''}
                          onChange={(e) => handleSpouseField('firstName', e.target.value)}
                        />
                        <Input
                          label="Last Name"
                          value={c.spouse?.lastName || ''}
                          onChange={(e) => handleSpouseField('lastName', e.target.value)}
                        />
                      </FieldRow>
                      <FieldRow>
                        <Input
                          label="Date of Birth"
                          type="date"
                          value={c.spouse?.dateOfBirth || ''}
                          onChange={(e) => handleSpouseField('dateOfBirth', e.target.value)}
                        />
                        <CurrencyInput
                          label="Annual Income"
                          value={c.spouse?.annualIncome || 0}
                          onValueChange={(v) => handleSpouseField('annualIncome', v)}
                        />
                      </FieldRow>
                      <FieldRow>
                        <Input
                          label="Retirement Age"
                          type="number"
                          min={50}
                          max={75}
                          value={c.spouse?.targetRetirementAge || 65}
                          onChange={(e) => handleSpouseField('targetRetirementAge', parseInt(e.target.value) || 65)}
                        />
                      </FieldRow>
                    </div>
                  )}
                </>
              )}

              {step === 'expenses' && (
                <>
                  <CurrencyInput
                    label="Monthly Living Expenses"
                    value={c.monthlyExpenses}
                    onValueChange={(v) => handleField('monthlyExpenses', v)}
                    hint="Total monthly spending including housing, food, utilities, transportation, etc."
                  />
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Annual expenses:</strong>{' '}
                      <span className="tabular-nums">
                        {(c.monthlyExpenses * 12).toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })}
                      </span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      In retirement, expenses are assumed at{' '}
                      {Math.round(c.projectionParams.retirementSpendingRate * 100)}% of pre-retirement.
                    </p>
                  </div>
                </>
              )}

              {step === 'assets' && (
                <>
                  <SectionTitle>RRSP / RRIF</SectionTitle>
                  <FieldRow>
                    <CurrencyInput
                      label="RRSP Balance"
                      value={c.rrspBalance}
                      onValueChange={(v) => handleField('rrspBalance', v)}
                    />
                    <CurrencyInput
                      label="Annual Contribution"
                      value={c.rrspAnnualContribution}
                      onValueChange={(v) => handleField('rrspAnnualContribution', v)}
                    />
                  </FieldRow>

                  <SectionDivider />

                  <SectionTitle>TFSA</SectionTitle>
                  <FieldRow>
                    <CurrencyInput
                      label="TFSA Balance"
                      value={c.tfsaBalance}
                      onValueChange={(v) => handleField('tfsaBalance', v)}
                    />
                    <CurrencyInput
                      label="Annual Contribution"
                      value={c.tfsaAnnualContribution}
                      onValueChange={(v) => handleField('tfsaAnnualContribution', v)}
                    />
                  </FieldRow>

                  <SectionDivider />

                  <SectionTitle>Non-Registered</SectionTitle>
                  <FieldRow cols={1}>
                    <CurrencyInput
                      label="Non-Registered Investments"
                      value={c.nonRegisteredInvestments}
                      onValueChange={(v) => handleField('nonRegisteredInvestments', v)}
                    />
                  </FieldRow>

                  <SectionDivider />

                  <SectionTitle>FHSA</SectionTitle>
                  <FieldRow>
                    <CurrencyInput
                      label="FHSA Balance"
                      value={c.fhsaBalance}
                      onValueChange={(v) => handleField('fhsaBalance', v)}
                    />
                    <CurrencyInput
                      label="Annual Contribution"
                      value={c.fhsaAnnualContribution}
                      onValueChange={(v) => handleField('fhsaAnnualContribution', v)}
                    />
                  </FieldRow>

                  {c.hasSpouse && (
                    <>
                      <SectionDivider />
                      <SectionTitle>Spouse Accounts</SectionTitle>
                      <FieldRow>
                        <CurrencyInput
                          label="Spouse RRSP Balance"
                          value={c.spouse?.rrspBalance || 0}
                          onValueChange={(v) => handleSpouseField('rrspBalance', v)}
                        />
                        <CurrencyInput
                          label="Spousal RRSP Balance"
                          value={c.spouse?.spousalRrspBalance || 0}
                          onValueChange={(v) => handleSpouseField('spousalRrspBalance', v)}
                          hint="Contributed by client, owned by spouse"
                        />
                      </FieldRow>
                      <FieldRow cols={1}>
                        <CurrencyInput
                          label="Spouse TFSA Balance"
                          value={c.spouse?.tfsaBalance || 0}
                          onValueChange={(v) => handleSpouseField('tfsaBalance', v)}
                        />
                      </FieldRow>
                    </>
                  )}
                </>
              )}

              {step === 'debts' && (
                <>
                  <SectionTitle>Primary Residence</SectionTitle>
                  <FieldRow>
                    <CurrencyInput
                      label="Home Value"
                      value={c.primaryResidenceValue}
                      onValueChange={(v) => handleField('primaryResidenceValue', v)}
                    />
                    <CurrencyInput
                      label="Mortgage Balance"
                      value={c.mortgageBalance}
                      onValueChange={(v) => handleField('mortgageBalance', v)}
                    />
                  </FieldRow>
                  <FieldRow>
                    <Input
                      label="Mortgage Rate (%)"
                      type="number"
                      step={0.01}
                      min={0}
                      max={15}
                      value={c.mortgageRate ? (c.mortgageRate * 100).toFixed(2) : ''}
                      onChange={(e) => handleField('mortgageRate', (parseFloat(e.target.value) || 0) / 100)}
                      hint="Annual interest rate"
                    />
                    <Input
                      label="Years Remaining"
                      type="number"
                      min={0}
                      max={30}
                      value={c.mortgageAmortizationYears || ''}
                      onChange={(e) => handleField('mortgageAmortizationYears', parseInt(e.target.value) || 0)}
                    />
                  </FieldRow>

                  <SectionDivider />

                  <SectionTitle>Other Debts</SectionTitle>
                  <FieldRow cols={1}>
                    <CurrencyInput
                      label="Total Other Debts"
                      value={c.otherDebts}
                      onValueChange={(v) => handleField('otherDebts', v)}
                      hint="Credit cards, loans, lines of credit, etc."
                    />
                  </FieldRow>
                </>
              )}

              {step === 'benefits' && (
                <>
                  <SectionTitle>CPP (Canada Pension Plan)</SectionTitle>
                  <FieldRow>
                    <CurrencyInput
                      label="Estimated CPP at 65 ($/month)"
                      value={c.projectionParams.estimatedCppMonthly}
                      onValueChange={(v) => handleParam('estimatedCppMonthly', v)}
                      hint={c.annualIncome > 0 ? `Estimate based on income: ~$${Math.round(estimateCppMonthlyAt65(c.annualIncome))}/mo` : undefined}
                    />
                    <Input
                      label="CPP Start Age"
                      type="number"
                      min={60}
                      max={70}
                      value={c.projectionParams.cppStartAge}
                      onChange={(e) => handleParam('cppStartAge', parseInt(e.target.value) || 65)}
                      hint="60 (early, reduced) to 70 (late, enhanced)"
                    />
                  </FieldRow>

                  {c.hasSpouse && (
                    <FieldRow>
                      <CurrencyInput
                        label="Spouse CPP at 65 ($/month)"
                        value={c.spouse?.estimatedCppMonthly || 0}
                        onValueChange={(v) => handleSpouseField('estimatedCppMonthly', v)}
                      />
                      <Input
                        label="Spouse CPP Start Age"
                        type="number"
                        min={60}
                        max={70}
                        value={c.spouse?.cppStartAge || 65}
                        onChange={(e) => handleSpouseField('cppStartAge', parseInt(e.target.value) || 65)}
                      />
                    </FieldRow>
                  )}

                  <SectionDivider />

                  <SectionTitle>OAS (Old Age Security)</SectionTitle>
                  <FieldRow>
                    <Input
                      label="OAS Start Age"
                      type="number"
                      min={65}
                      max={70}
                      value={c.projectionParams.oasStartAge}
                      onChange={(e) => handleParam('oasStartAge', parseInt(e.target.value) || 65)}
                      hint="65 to 70. Deferring increases benefit by 0.6%/month."
                    />
                  </FieldRow>

                  {c.hasSpouse && (
                    <FieldRow>
                      <Input
                        label="Spouse OAS Start Age"
                        type="number"
                        min={65}
                        max={70}
                        value={c.spouse?.oasStartAge || 65}
                        onChange={(e) => handleSpouseField('oasStartAge', parseInt(e.target.value) || 65)}
                      />
                    </FieldRow>
                  )}

                  <SectionDivider />

                  <SectionTitle>Employer Pension</SectionTitle>
                  <Select
                    label="Pension Type"
                    value={c.pensionType}
                    onChange={(e) => handleField('pensionType', e.target.value)}
                    options={PENSION_OPTIONS}
                  />

                  {c.pensionType === 'db' && (
                    <div className="mt-4">
                      <FieldRow cols={1}>
                        <CurrencyInput
                          label="Annual Pension Benefit (at retirement)"
                          value={c.pensionDetails?.annualBenefitEstimate || 0}
                          onValueChange={(v) => handlePensionDetail('annualBenefitEstimate', v)}
                        />
                      </FieldRow>
                    </div>
                  )}

                  {c.pensionType === 'dc' && (
                    <div className="mt-4 space-y-4">
                      <FieldRow>
                        <CurrencyInput
                          label="Current Balance"
                          value={c.pensionDetails?.currentBalance || 0}
                          onValueChange={(v) => handlePensionDetail('currentBalance', v)}
                        />
                        <CurrencyInput
                          label="Annual Contribution"
                          value={c.pensionDetails?.annualContribution || 0}
                          onValueChange={(v) => handlePensionDetail('annualContribution', v)}
                          hint="Employee + employer combined"
                        />
                      </FieldRow>
                    </div>
                  )}
                </>
              )}

              {step === 'insurance' && (
                <>
                  <Toggle
                    label="Life Insurance"
                    checked={c.hasLifeInsurance}
                    onChange={(v) => handleField('hasLifeInsurance', v)}
                  />

                  {c.hasLifeInsurance && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                      <FieldRow>
                        <CurrencyInput
                          label="Coverage Amount"
                          value={c.lifeInsuranceDetails?.coverageAmount || 0}
                          onValueChange={(v) => handleInsuranceDetail('coverageAmount', v)}
                        />
                        <Select
                          label="Type"
                          value={c.lifeInsuranceDetails?.type || 'term'}
                          onChange={(e) => handleInsuranceDetail('type', e.target.value as InsuranceType)}
                          options={INSURANCE_TYPE_OPTIONS}
                        />
                      </FieldRow>
                      <Select
                        label="Source"
                        value={c.lifeInsuranceDetails?.source || 'personal'}
                        onChange={(e) => handleInsuranceDetail('source', e.target.value as InsuranceSource)}
                        options={INSURANCE_SOURCE_OPTIONS}
                      />
                    </div>
                  )}

                  <SectionDivider />

                  <Toggle
                    label="Disability Insurance"
                    checked={c.hasDisabilityInsurance}
                    onChange={(v) => handleField('hasDisabilityInsurance', v)}
                  />

                  <SectionDivider />

                  <Toggle
                    label="Critical Illness Insurance"
                    checked={c.hasCriticalIllness}
                    onChange={(v) => handleField('hasCriticalIllness', v)}
                  />
                </>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200">
              {currentStepIndex > 0 ? (
                <button
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Previous
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={goNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors shadow-sm"
              >
                {currentStepIndex < STEPS.length - 1 ? (
                  <>
                    Next
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                ) : (
                  <>
                    View Projections
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
