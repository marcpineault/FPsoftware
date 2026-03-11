import { useCallback, useState, useEffect, useRef } from 'react';
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
  { id: 'client', label: 'Client Info' },
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'assets', label: 'Assets' },
  { id: 'debts', label: 'Debts' },
  { id: 'benefits', label: "Benefits" },
  { id: 'insurance', label: 'Insurance' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const PROVINCE_OPTIONS = Object.entries(PROVINCE_NAMES).map(([value, label]) => ({ value, label }));
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
// Layout helpers
// ---------------------------------------------------------------------------

function FieldRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : cols === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {children}
    </div>
  );
}

function FormCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {title && (
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/80">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        </div>
      )}
      <div className="px-6 py-5 space-y-5">
        {children}
      </div>
    </div>
  );
}

function SaveIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 animate-fade-in">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 7L6.5 9L9.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Saved
    </span>
  );
}

function fmtC(n: number): string {
  if (!n) return '$0';
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
  const [showSaved, setShowSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flashSaved = useCallback(() => {
    setShowSaved(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setShowSaved(false), 2000);
  }, []);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const handleField = useCallback(
    (field: keyof Client, value: Client[keyof Client]) => {
      if (!currentClient) return;
      updateClient({ [field]: value });
      flashSaved();
    },
    [currentClient, updateClient, flashSaved],
  );

  const handleParam = useCallback(
    (field: string, value: number | boolean) => {
      if (!currentClient) return;
      updateClient({ projectionParams: { ...currentClient.projectionParams, [field]: value } });
      flashSaved();
    },
    [currentClient, updateClient, flashSaved],
  );

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
      flashSaved();
    },
    [currentClient, updateClient, flashSaved],
  );

  const handleInsuranceDetail = useCallback(
    (field: string, value: string | number) => {
      if (!currentClient) return;
      const details = currentClient.lifeInsuranceDetails || {
        coverageAmount: 0, type: 'term' as InsuranceType, source: 'personal' as InsuranceSource,
      };
      updateClient({ lifeInsuranceDetails: { ...details, [field]: value } });
      flashSaved();
    },
    [currentClient, updateClient, flashSaved],
  );

  const handlePensionDetail = useCallback(
    (field: string, value: number) => {
      if (!currentClient) return;
      const details = currentClient.pensionDetails || {
        annualBenefitEstimate: 0, currentBalance: 0, annualContribution: 0,
      };
      updateClient({ pensionDetails: { ...details, [field]: value } });
      flashSaved();
    },
    [currentClient, updateClient, flashSaved],
  );

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      navigate(`/client/${id}/setup/${STEPS[currentStepIndex + 1].id}`);
    } else {
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
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const c = currentClient;

  return (
    <div className="flex h-full bg-gray-100/80">
      {/* Step sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 py-4 overflow-y-auto hidden md:flex flex-col">
        <nav className="flex-1 space-y-0.5 px-3">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const visited = i < currentStepIndex;
            return (
              <Link
                key={s.id}
                to={`/client/${id}/setup/${s.id}`}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg text-[13px] transition-all
                  ${active
                    ? 'bg-amber-50 text-amber-700 font-semibold shadow-sm border border-amber-200'
                    : visited
                    ? 'text-slate-600 hover:bg-gray-50 font-medium'
                    : 'text-slate-400 hover:bg-gray-50 hover:text-slate-500'
                  }
                `}
              >
                <span
                  className={`
                    flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all
                    ${active
                      ? 'bg-amber-500 text-white shadow-sm'
                      : visited
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-gray-100 text-slate-400'
                    }
                  `}
                >
                  {visited && !active ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

        <div className="px-5 pt-3 mt-auto border-t border-gray-100">
          <p className="text-[11px] text-slate-400">
            {currentStepIndex + 1} / {STEPS.length}
          </p>
        </div>
      </aside>

      {/* Step content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile step indicator */}
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{currentStepIndex + 1}</span>
              <div>
                <span className="text-sm font-semibold text-slate-700 block">{STEPS[currentStepIndex].label}</span>
                <span className="text-[11px] text-slate-400">Step {currentStepIndex + 1} of {STEPS.length}</span>
              </div>
            </div>
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i <= currentStepIndex ? 'bg-amber-400' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
            {/* Step header */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold text-slate-800">
                {STEPS[currentStepIndex].label}
              </h2>
              <SaveIndicator show={showSaved} />
            </div>

            {/* Step forms */}
            {step === 'client' && (
              <FormCard>
                <FieldRow>
                  <Input label="First Name" value={c.firstName} onChange={(e) => handleField('firstName', e.target.value)} placeholder="John" />
                  <Input label="Last Name" value={c.lastName} onChange={(e) => handleField('lastName', e.target.value)} placeholder="Smith" />
                </FieldRow>
                <FieldRow>
                  <Input label="Date of Birth" type="date" value={c.dateOfBirth} onChange={(e) => handleField('dateOfBirth', e.target.value)} />
                  <Select label="Province" value={c.province} onChange={(e) => handleField('province', e.target.value as CanadianProvince)} options={PROVINCE_OPTIONS} />
                </FieldRow>
              </FormCard>
            )}

            {step === 'income' && (
              <>
                <FormCard title="Employment">
                  <FieldRow>
                    <Select label="Employment Status" value={c.employmentStatus} onChange={(e) => handleField('employmentStatus', e.target.value as EmploymentStatus)} options={EMPLOYMENT_OPTIONS} />
                    <CurrencyInput label="Annual Income" value={c.annualIncome} onValueChange={(v) => handleField('annualIncome', v)} />
                  </FieldRow>
                  <FieldRow cols={1}>
                    <Input label="Target Retirement Age" type="number" min={50} max={75} value={c.targetRetirementAge || ''} onChange={(e) => handleField('targetRetirementAge', parseInt(e.target.value) || 65)} />
                  </FieldRow>
                </FormCard>

                <FormCard title="Spouse / Partner">
                  <Toggle label="Has Spouse / Partner" checked={c.hasSpouse} onChange={(v) => handleField('hasSpouse', v)} />
                  {c.hasSpouse && (
                    <div className="mt-3 pt-4 border-t border-gray-100 space-y-4">
                      <FieldRow>
                        <Input label="Spouse First Name" value={c.spouse?.firstName || ''} onChange={(e) => handleSpouseField('firstName', e.target.value)} />
                        <Input label="Spouse Last Name" value={c.spouse?.lastName || ''} onChange={(e) => handleSpouseField('lastName', e.target.value)} />
                      </FieldRow>
                      <FieldRow>
                        <Input label="Date of Birth" type="date" value={c.spouse?.dateOfBirth || ''} onChange={(e) => handleSpouseField('dateOfBirth', e.target.value)} />
                        <CurrencyInput label="Annual Income" value={c.spouse?.annualIncome || 0} onValueChange={(v) => handleSpouseField('annualIncome', v)} />
                      </FieldRow>
                      <FieldRow cols={1}>
                        <Input label="Retirement Age" type="number" min={50} max={75} value={c.spouse?.targetRetirementAge || 65} onChange={(e) => handleSpouseField('targetRetirementAge', parseInt(e.target.value) || 65)} />
                      </FieldRow>
                    </div>
                  )}
                </FormCard>
              </>
            )}

            {step === 'expenses' && (
              <FormCard title="Living Expenses">
                <CurrencyInput
                  label="Monthly Living Expenses"
                  value={c.monthlyExpenses}
                  onValueChange={(v) => handleField('monthlyExpenses', v)}
                  hint={c.monthlyExpenses > 0 ? `${fmtC(c.monthlyExpenses * 12)}/year` : 'Total monthly spending'}
                />
              </FormCard>
            )}

            {step === 'assets' && (
              <>
                <FormCard title="Registered Accounts">
                  <p className="text-xs text-slate-400 -mt-2 mb-4">Balance and annual contribution for each account type</p>
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">RRSP / RRIF</p>
                      <FieldRow>
                        <CurrencyInput label="Balance" value={c.rrspBalance} onValueChange={(v) => handleField('rrspBalance', v)} />
                        <CurrencyInput label="Annual Contribution" value={c.rrspAnnualContribution} onValueChange={(v) => handleField('rrspAnnualContribution', v)} />
                      </FieldRow>
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-slate-500 mb-2">TFSA</p>
                      <FieldRow>
                        <CurrencyInput label="Balance" value={c.tfsaBalance} onValueChange={(v) => handleField('tfsaBalance', v)} />
                        <CurrencyInput label="Annual Contribution" value={c.tfsaAnnualContribution} onValueChange={(v) => handleField('tfsaAnnualContribution', v)} />
                      </FieldRow>
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-slate-500 mb-2">FHSA</p>
                      <FieldRow>
                        <CurrencyInput label="Balance" value={c.fhsaBalance} onValueChange={(v) => handleField('fhsaBalance', v)} />
                        <CurrencyInput label="Annual Contribution" value={c.fhsaAnnualContribution} onValueChange={(v) => handleField('fhsaAnnualContribution', v)} />
                      </FieldRow>
                    </div>
                  </div>
                </FormCard>
                <FormCard title="Non-Registered">
                  <CurrencyInput label="Non-Registered Investments" value={c.nonRegisteredInvestments} onValueChange={(v) => handleField('nonRegisteredInvestments', v)} />
                </FormCard>
                {c.hasSpouse && (
                  <FormCard title="Spouse Accounts">
                    <FieldRow>
                      <CurrencyInput label="Spouse RRSP Balance" value={c.spouse?.rrspBalance || 0} onValueChange={(v) => handleSpouseField('rrspBalance', v)} />
                      <CurrencyInput label="Spousal RRSP" value={c.spouse?.spousalRrspBalance || 0} onValueChange={(v) => handleSpouseField('spousalRrspBalance', v)} hint="Contributed by client, owned by spouse" />
                    </FieldRow>
                    <CurrencyInput label="Spouse TFSA Balance" value={c.spouse?.tfsaBalance || 0} onValueChange={(v) => handleSpouseField('tfsaBalance', v)} />
                  </FormCard>
                )}
              </>
            )}

            {step === 'debts' && (
              <>
                <FormCard title="Primary Residence">
                  <FieldRow>
                    <CurrencyInput label="Home Value" value={c.primaryResidenceValue} onValueChange={(v) => handleField('primaryResidenceValue', v)} />
                    <CurrencyInput label="Mortgage Balance" value={c.mortgageBalance} onValueChange={(v) => handleField('mortgageBalance', v)} />
                  </FieldRow>
                  <FieldRow>
                    <Input label="Mortgage Rate (%)" type="number" step={0.01} min={0} max={15} value={c.mortgageRate ? (c.mortgageRate * 100).toFixed(2) : ''} onChange={(e) => handleField('mortgageRate', (parseFloat(e.target.value) || 0) / 100)} hint="Annual interest rate" />
                    <Input label="Years Remaining" type="number" min={0} max={30} value={c.mortgageAmortizationYears || ''} onChange={(e) => handleField('mortgageAmortizationYears', parseInt(e.target.value) || 0)} />
                  </FieldRow>
                </FormCard>
                <FormCard title="Other Debts">
                  <CurrencyInput label="Total Other Debts" value={c.otherDebts} onValueChange={(v) => handleField('otherDebts', v)} hint="Credit cards, loans, lines of credit, etc." />
                </FormCard>
              </>
            )}

            {step === 'benefits' && (
              <>
                <FormCard title="CPP (Canada Pension Plan)">
                  {c.annualIncome > 0 && c.projectionParams.estimatedCppMonthly === 0 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center justify-between mb-3">
                      <p className="text-xs text-amber-700">
                        Based on income of {fmtC(c.annualIncome)}, estimated CPP is <strong>${Math.round(estimateCppMonthlyAt65(c.annualIncome))}/mo</strong>
                      </p>
                      <button
                        onClick={() => handleParam('estimatedCppMonthly', estimateCppMonthlyAt65(c.annualIncome))}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-100 transition-colors shrink-0"
                      >
                        Use estimate
                      </button>
                    </div>
                  )}
                  <FieldRow>
                    <CurrencyInput label="Est. CPP at 65 ($/month)" value={c.projectionParams.estimatedCppMonthly} onValueChange={(v) => handleParam('estimatedCppMonthly', v)} hint={c.annualIncome > 0 ? `Based on income: ~$${Math.round(estimateCppMonthlyAt65(c.annualIncome))}/mo` : undefined} />
                    <Input label="CPP Start Age" type="number" min={60} max={70} value={c.projectionParams.cppStartAge} onChange={(e) => handleParam('cppStartAge', parseInt(e.target.value) || 65)} hint="60 (reduced) to 70 (enhanced)" />
                  </FieldRow>
                  {c.hasSpouse && (
                    <FieldRow>
                      <CurrencyInput label="Spouse CPP at 65 ($/mo)" value={c.spouse?.estimatedCppMonthly || 0} onValueChange={(v) => handleSpouseField('estimatedCppMonthly', v)} />
                      <Input label="Spouse CPP Start Age" type="number" min={60} max={70} value={c.spouse?.cppStartAge || 65} onChange={(e) => handleSpouseField('cppStartAge', parseInt(e.target.value) || 65)} />
                    </FieldRow>
                  )}
                </FormCard>
                <FormCard title="OAS (Old Age Security)">
                  <FieldRow cols={1}>
                    <Input label="OAS Start Age" type="number" min={65} max={70} value={c.projectionParams.oasStartAge} onChange={(e) => handleParam('oasStartAge', parseInt(e.target.value) || 65)} hint="65 to 70. Deferring increases benefit by 0.6%/month." />
                  </FieldRow>
                  {c.hasSpouse && (
                    <FieldRow cols={1}>
                      <Input label="Spouse OAS Start Age" type="number" min={65} max={70} value={c.spouse?.oasStartAge || 65} onChange={(e) => handleSpouseField('oasStartAge', parseInt(e.target.value) || 65)} />
                    </FieldRow>
                  )}
                </FormCard>
                <FormCard title="Employer Pension">
                  <Select label="Pension Type" value={c.pensionType} onChange={(e) => handleField('pensionType', e.target.value)} options={PENSION_OPTIONS} />
                  {c.pensionType === 'db' && (
                    <CurrencyInput label="Annual Pension Benefit (at retirement)" value={c.pensionDetails?.annualBenefitEstimate || 0} onValueChange={(v) => handlePensionDetail('annualBenefitEstimate', v)} />
                  )}
                  {c.pensionType === 'dc' && (
                    <FieldRow>
                      <CurrencyInput label="Current Balance" value={c.pensionDetails?.currentBalance || 0} onValueChange={(v) => handlePensionDetail('currentBalance', v)} />
                      <CurrencyInput label="Annual Contribution" value={c.pensionDetails?.annualContribution || 0} onValueChange={(v) => handlePensionDetail('annualContribution', v)} hint="Employee + employer combined" />
                    </FieldRow>
                  )}
                </FormCard>
              </>
            )}

            {step === 'insurance' && (
              <>
                <FormCard title="Life Insurance">
                  <Toggle label="Has Life Insurance" checked={c.hasLifeInsurance} onChange={(v) => handleField('hasLifeInsurance', v)} />
                  {c.hasLifeInsurance && (
                    <div className="mt-3 pt-4 border-t border-gray-100 space-y-4">
                      <FieldRow>
                        <CurrencyInput label="Coverage Amount" value={c.lifeInsuranceDetails?.coverageAmount || 0} onValueChange={(v) => handleInsuranceDetail('coverageAmount', v)} />
                        <Select label="Type" value={c.lifeInsuranceDetails?.type || 'term'} onChange={(e) => handleInsuranceDetail('type', e.target.value as InsuranceType)} options={INSURANCE_TYPE_OPTIONS} />
                      </FieldRow>
                      <Select label="Source" value={c.lifeInsuranceDetails?.source || 'personal'} onChange={(e) => handleInsuranceDetail('source', e.target.value as InsuranceSource)} options={INSURANCE_SOURCE_OPTIONS} />
                    </div>
                  )}
                </FormCard>
                <FormCard title="Other Coverage">
                  <Toggle label="Disability Insurance" checked={c.hasDisabilityInsurance} onChange={(v) => handleField('hasDisabilityInsurance', v)} />
                  <div className="pt-3 border-t border-gray-100">
                    <Toggle label="Critical Illness Insurance" checked={c.hasCriticalIllness} onChange={(v) => handleField('hasCriticalIllness', v)} />
                  </div>
                </FormCard>
              </>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 pb-2">
              {currentStepIndex > 0 ? (
                <button
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-slate-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-all"
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
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all"
              >
                {currentStepIndex < STEPS.length - 1 ? 'Next' : 'View Projections'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
