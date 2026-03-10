import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value === 0) return '$0.00';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
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

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

const STEPS = ['Personal', 'Financial', 'Insurance'] as const;
type StepIndex = 0 | 1 | 2;

interface StepperProps {
  current: StepIndex;
  onStepClick: (step: StepIndex) => void;
}

function Stepper({ current, onStepClick }: StepperProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const idx = i as StepIndex;
        const isActive = idx === current;
        const isCompleted = idx < current;

        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <div
                className={`h-0.5 w-12 sm:w-20 transition-colors ${
                  isCompleted ? 'bg-accent' : 'bg-card-border'
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => onStepClick(idx)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer
                ${
                  isActive
                    ? 'bg-navy text-white shadow-md'
                    : isCompleted
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'bg-bg-secondary text-text-secondary border border-card-border'
                }`}
            >
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                  ${
                    isActive
                      ? 'bg-white text-navy'
                      : isCompleted
                      ? 'bg-accent text-white'
                      : 'bg-card-border text-text-secondary'
                  }`}
              >
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Currency Input
// ---------------------------------------------------------------------------

interface CurrencyInputProps {
  value: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  id?: string;
}

function CurrencyInput({
  value,
  onChange,
  onBlur,
  placeholder = '$0.00',
  id,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(value ? formatCurrency(value) : '');
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value changes when not focused
  useEffect(() => {
    if (!isFocused) {
      setDisplay(value ? formatCurrency(value) : '');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number for editing
    setDisplay(value ? String(value) : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseCurrency(display);
    onChange(parsed);
    setDisplay(parsed ? formatCurrency(parsed) : '');
    onBlur?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, dot, comma, dollar sign
    if (/^[$,.\d\s]*$/.test(raw)) {
      setDisplay(raw);
      const parsed = parseCurrency(raw);
      onChange(parsed);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className="tabular-nums w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy focus:ring-2 focus:ring-navy/20 focus:outline-none transition-colors"
    />
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  id?: string;
}

function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-3 cursor-pointer select-none"
    >
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-navy/20 ${
          checked ? 'bg-accent' : 'bg-card-border'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-text-primary">{label}</span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper
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

// ---------------------------------------------------------------------------
// Select input styles (shared)
// ---------------------------------------------------------------------------

const selectClass =
  'w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-2 focus:ring-navy/20 focus:outline-none transition-colors appearance-none cursor-pointer';

const inputClass =
  'w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy focus:ring-2 focus:ring-navy/20 focus:outline-none transition-colors';

// ---------------------------------------------------------------------------
// Person Fields (shared between primary & spouse)
// ---------------------------------------------------------------------------

interface PersonFieldsProps {
  prefix: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  employmentStatus: EmploymentStatus;
  annualIncome: number;
  targetRetirementAge: number;
  province?: CanadianProvince;
  showProvince?: boolean;
  onFieldChange: (field: string, value: string | number) => void;
  onBlur: () => void;
}

function PersonFields({
  prefix,
  firstName,
  lastName,
  dateOfBirth,
  employmentStatus,
  annualIncome,
  targetRetirementAge,
  province,
  showProvince = false,
  onFieldChange,
  onBlur,
}: PersonFieldsProps) {
  const age = calculateAge(dateOfBirth);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* First Name */}
      <Field label="First Name">
        <input
          type="text"
          value={firstName}
          onChange={(e) => onFieldChange(`${prefix}firstName`, e.target.value)}
          onBlur={onBlur}
          placeholder="e.g. Sarah"
          className={inputClass}
        />
      </Field>

      {/* Last Name */}
      <Field label="Last Name">
        <input
          type="text"
          value={lastName}
          onChange={(e) => onFieldChange(`${prefix}lastName`, e.target.value)}
          onBlur={onBlur}
          placeholder="e.g. Thompson"
          className={inputClass}
        />
      </Field>

      {/* Date of Birth */}
      <Field
        label="Date of Birth"
        hint={age !== null ? `Age: ${age}` : undefined}
      >
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => onFieldChange(`${prefix}dateOfBirth`, e.target.value)}
          onBlur={onBlur}
          className={inputClass}
        />
      </Field>

      {/* Province (primary only) */}
      {showProvince && (
        <Field label="Province">
          <select
            value={province ?? 'ON'}
            onChange={(e) =>
              onFieldChange(`${prefix}province`, e.target.value)
            }
            onBlur={onBlur}
            className={selectClass}
          >
            {Object.entries(PROVINCE_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Employment Status */}
      <Field label="Employment Status">
        <select
          value={employmentStatus}
          onChange={(e) =>
            onFieldChange(`${prefix}employmentStatus`, e.target.value)
          }
          onBlur={onBlur}
          className={selectClass}
        >
          <option value="employed">Employed</option>
          <option value="self-employed">Self-employed</option>
          <option value="retired">Retired</option>
          <option value="other">Other</option>
        </select>
      </Field>

      {/* Annual Employment Income */}
      <Field label="Annual Employment Income">
        <CurrencyInput
          value={annualIncome}
          onChange={(v) => onFieldChange(`${prefix}annualIncome`, v)}
          onBlur={onBlur}
          placeholder="$75,000.00"
        />
      </Field>

      {/* Target Retirement Age */}
      <Field label="Target Retirement Age">
        <input
          type="number"
          min={40}
          max={80}
          value={targetRetirementAge || ''}
          onChange={(e) =>
            onFieldChange(
              `${prefix}targetRetirementAge`,
              parseInt(e.target.value, 10) || 0,
            )
          }
          onBlur={onBlur}
          placeholder="65"
          className={inputClass}
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Profile Component
// ---------------------------------------------------------------------------

export function Profile() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentClient, updateClient } = useAppStore();

  const [step, setStep] = useState<StepIndex>(0);
  const [includeSpouseInProjections, setIncludeSpouseInProjections] =
    useState(true);
  const [expensesAnnual, setExpensesAnnual] = useState(false);

  // -----------------------------------------------------------------------
  // Auto-save on blur
  // -----------------------------------------------------------------------

  const save = useCallback(
    (updates: Partial<Client>) => {
      updateClient(updates);
    },
    [updateClient],
  );

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

  // -----------------------------------------------------------------------
  // Generic field updater for flat client fields
  // -----------------------------------------------------------------------

  const handleField = (field: string, value: string | number | boolean) => {
    // Spouse fields are nested
    if (field.startsWith('spouse.')) {
      const spouseField = field.replace('spouse.', '');
      const updatedSpouse = { ...(c.spouse ?? {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        employmentStatus: 'employed' as EmploymentStatus,
        annualIncome: 0,
        targetRetirementAge: 65,
        estimatedCppMonthly: 800,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 0,
        spousalRrspBalance: 0,
        tfsaBalance: 0,
      }), [spouseField]: value };
      save({ spouse: updatedSpouse });
      return;
    }

    // Projection params
    if (field.startsWith('projectionParams.')) {
      const paramField = field.replace('projectionParams.', '');
      const updatedParams = { ...c.projectionParams, [paramField]: value };
      save({ projectionParams: updatedParams });
      return;
    }

    // Pension details
    if (field.startsWith('pension.')) {
      const pensionField = field.replace('pension.', '');
      const updatedPension = { ...(c.pensionDetails ?? {}), [pensionField]: value };
      save({ pensionDetails: updatedPension });
      return;
    }

    // Life insurance details
    if (field.startsWith('lifeIns.')) {
      const lifeField = field.replace('lifeIns.', '');
      const updatedLife = { ...(c.lifeInsuranceDetails ?? {
        coverageAmount: 0,
        type: 'term' as InsuranceType,
        source: 'personal' as InsuranceSource,
      }), [lifeField]: value };
      save({ lifeInsuranceDetails: updatedLife });
      return;
    }

    // Sync target retirement age to projection params
    if (field === 'targetRetirementAge' && typeof value === 'number' && value >= 40 && value <= 80) {
      save({ [field]: value, projectionParams: { ...c.projectionParams, retirementAge: value } } as Partial<Client>);
      return;
    }

    save({ [field]: value } as Partial<Client>);
  };

  const handleBlur = () => {
    // Auto-save already happens in handleField via save(). This is a no-op
    // hook for CurrencyInput/PersonFields blur.
  };

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  const goNext = () => {
    if (step < 2) {
      setStep((step + 1) as StepIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Final step -> mark complete & navigate
      save({ profileComplete: true });
      navigate(`/client/${id}/projections`);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep((step - 1) as StepIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // -----------------------------------------------------------------------
  // STEP 1: Personal Info
  // -----------------------------------------------------------------------

  const renderPersonalStep = () => (
    <div className="space-y-6">
      {/* Primary Client */}
      <Card title="Primary Client">
        <PersonFields
          prefix=""
          firstName={c.firstName}
          lastName={c.lastName}
          dateOfBirth={c.dateOfBirth}
          employmentStatus={c.employmentStatus}
          annualIncome={c.annualIncome}
          targetRetirementAge={c.targetRetirementAge}
          province={c.province}
          showProvince
          onFieldChange={handleField}
          onBlur={handleBlur}
        />
      </Card>

      {/* Spouse Toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-navy tracking-wide">
              Spouse / Partner
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">
              Include a spouse or partner in the financial plan
            </p>
          </div>
          <Toggle
            checked={c.hasSpouse}
            onChange={(v) => handleField('hasSpouse', v)}
            id="spouse-toggle"
          />
        </div>

        {c.hasSpouse && (
          <div className="mt-6 pt-6 border-t border-card-border">
            <PersonFields
              prefix="spouse."
              firstName={c.spouse?.firstName ?? ''}
              lastName={c.spouse?.lastName ?? ''}
              dateOfBirth={c.spouse?.dateOfBirth ?? ''}
              employmentStatus={c.spouse?.employmentStatus ?? 'employed'}
              annualIncome={c.spouse?.annualIncome ?? 0}
              targetRetirementAge={c.spouse?.targetRetirementAge ?? 65}
              onFieldChange={handleField}
              onBlur={handleBlur}
            />

            {/* Spouse CPP/OAS & Registered Accounts */}
            <div className="mt-6 pt-4 border-t border-card-border/60">
              <p className="text-xs text-text-tertiary tracking-wider uppercase mb-3">Spouse Government Benefits &amp; Accounts</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Estimated CPP (monthly)">
                  <div className="flex gap-2">
                    <CurrencyInput
                      value={c.spouse?.estimatedCppMonthly ?? 800}
                      onChange={(v) => handleField('spouse.estimatedCppMonthly', v)}
                      onBlur={handleBlur}
                      placeholder="$800.00"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const est = estimateCppMonthlyAt65(c.spouse?.annualIncome ?? 0);
                        handleField('spouse.estimatedCppMonthly', est);
                      }}
                      className="shrink-0 px-3 py-2 rounded-lg bg-navy/10 text-navy text-xs font-medium hover:bg-navy/20 transition-colors"
                      title="Estimate CPP based on spouse's income"
                    >
                      Est.
                    </button>
                  </div>
                </Field>
                <Field label="CPP Start Age">
                  <input
                    type="number"
                    min={60}
                    max={70}
                    value={c.spouse?.cppStartAge ?? 65}
                    onChange={(e) => handleField('spouse.cppStartAge', parseInt(e.target.value) || 65)}
                    className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
                  />
                </Field>
                <Field label="OAS Start Age">
                  <input
                    type="number"
                    min={65}
                    max={70}
                    value={c.spouse?.oasStartAge ?? 65}
                    onChange={(e) => handleField('spouse.oasStartAge', parseInt(e.target.value) || 65)}
                    className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <Field label="Spouse RRSP Balance">
                  <CurrencyInput
                    value={c.spouse?.rrspBalance ?? 0}
                    onChange={(v) => handleField('spouse.rrspBalance', v)}
                    onBlur={handleBlur}
                    placeholder="$0.00"
                  />
                </Field>
                <Field label="Spousal RRSP (contributed by client)">
                  <CurrencyInput
                    value={c.spouse?.spousalRrspBalance ?? 0}
                    onChange={(v) => handleField('spouse.spousalRrspBalance', v)}
                    onBlur={handleBlur}
                    placeholder="$0.00"
                  />
                </Field>
                <Field label="Spouse TFSA Balance">
                  <CurrencyInput
                    value={c.spouse?.tfsaBalance ?? 0}
                    onChange={(v) => handleField('spouse.tfsaBalance', v)}
                    onBlur={handleBlur}
                    placeholder="$0.00"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSpouseInProjections}
                  onChange={(e) =>
                    setIncludeSpouseInProjections(e.target.checked)
                  }
                  className="h-4 w-4 rounded border-card-border text-accent focus:ring-accent/30"
                />
                <span className="text-sm text-text-primary">
                  Include spouse in joint projections
                </span>
              </label>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  // -----------------------------------------------------------------------
  // STEP 2: Financial Snapshot
  // -----------------------------------------------------------------------

  const renderFinancialStep = () => (
    <div className="space-y-6">
      {/* Registered Accounts */}
      <Card title="Registered Accounts">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="RRSP Balance">
            <CurrencyInput
              value={c.rrspBalance}
              onChange={(v) => handleField('rrspBalance', v)}
              onBlur={handleBlur}
              placeholder="$50,000.00"
            />
          </Field>
          <Field label="RRSP Annual Contribution">
            <CurrencyInput
              value={c.rrspAnnualContribution}
              onChange={(v) => handleField('rrspAnnualContribution', v)}
              onBlur={handleBlur}
              placeholder="$6,000.00"
            />
          </Field>
          <Field label="RRSP Deduction Room (from NOA)">
            <CurrencyInput
              value={c.rrspDeductionRoom}
              onChange={(v) => handleField('rrspDeductionRoom', v)}
              onBlur={handleBlur}
              placeholder="$30,000.00"
            />
          </Field>
          <Field label="TFSA Balance">
            <CurrencyInput
              value={c.tfsaBalance}
              onChange={(v) => handleField('tfsaBalance', v)}
              onBlur={handleBlur}
              placeholder="$35,000.00"
            />
          </Field>
          <Field label="TFSA Annual Contribution">
            <CurrencyInput
              value={c.tfsaAnnualContribution}
              onChange={(v) => handleField('tfsaAnnualContribution', v)}
              onBlur={handleBlur}
              placeholder="$7,000.00"
            />
          </Field>
          <Field label="FHSA Balance">
            <CurrencyInput
              value={c.fhsaBalance}
              onChange={(v) => handleField('fhsaBalance', v)}
              onBlur={handleBlur}
              placeholder="$8,000.00"
            />
          </Field>
          <Field label="FHSA Annual Contribution">
            <CurrencyInput
              value={c.fhsaAnnualContribution}
              onChange={(v) => handleField('fhsaAnnualContribution', v)}
              onBlur={handleBlur}
              placeholder="$8,000.00"
            />
          </Field>
        </div>
      </Card>

      {/* Non-Registered Investments */}
      <Card title="Non-Registered Investments">
        <Field label="Non-Registered Investment Balance">
          <CurrencyInput
            value={c.nonRegisteredInvestments}
            onChange={(v) => handleField('nonRegisteredInvestments', v)}
            onBlur={handleBlur}
            placeholder="$25,000.00"
          />
        </Field>
      </Card>

      {/* RESP / Education Savings */}
      <Card title="RESP &amp; Education Savings">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Total RESP Balance (all children)">
              <CurrencyInput
                value={c.children.reduce((sum, ch) => sum + (ch.respBalance ?? 0), 0)}
                onChange={(v) => {
                  // Distribute evenly if multiple children, or set on first
                  if (c.children.length > 0) {
                    const perChild = v / c.children.length;
                    const updated = c.children.map(ch => ({ ...ch, respBalance: perChild }));
                    save({ children: updated });
                  }
                }}
                onBlur={handleBlur}
                placeholder="$10,000.00"
              />
            </Field>
            <Field label="RESP Annual Contribution (total)">
              <CurrencyInput
                value={c.respAnnualContribution}
                onChange={(v) => handleField('respAnnualContribution', v)}
                onBlur={handleBlur}
                placeholder="$2,500.00"
              />
            </Field>
          </div>

          {/* Children */}
          <div className="pt-3 border-t border-card-border/60">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-text-tertiary tracking-wider uppercase">Children (RESP Beneficiaries)</p>
              <button
                type="button"
                onClick={() => {
                  const updated = [...c.children, { name: '', dateOfBirth: '', respBalance: 0 }];
                  save({ children: updated });
                }}
                className="text-xs text-accent hover:text-accent-hover font-medium"
              >
                + Add Child
              </button>
            </div>
            {c.children.length === 0 && (
              <p className="text-sm text-text-tertiary italic">No children added. CESG matching requires at least one beneficiary.</p>
            )}
            {c.children.map((child, idx) => (
              <div key={idx} className="flex items-end gap-3 mb-2">
                <div className="flex-1">
                  <label className="text-xs text-text-secondary">Name</label>
                  <input
                    type="text"
                    value={child.name}
                    onChange={(e) => {
                      const updated = [...c.children];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      save({ children: updated });
                    }}
                    placeholder="Child's name"
                    className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
                  />
                </div>
                <div className="w-40">
                  <label className="text-xs text-text-secondary">Date of Birth</label>
                  <input
                    type="date"
                    value={child.dateOfBirth}
                    onChange={(e) => {
                      const updated = [...c.children];
                      updated[idx] = { ...updated[idx], dateOfBirth: e.target.value };
                      save({ children: updated });
                    }}
                    className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = c.children.filter((_, i) => i !== idx);
                    save({ children: updated });
                  }}
                  className="p-2 text-text-tertiary hover:text-negative transition-colors"
                  title="Remove child"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {c.respAnnualContribution > 0 && (
            <div className="mt-2 p-3 rounded-lg bg-positive/5 border border-positive/20">
              <p className="text-xs text-positive">
                CESG: Government matches 20% of contributions up to $500/year per child ($7,200 lifetime max per child).
                {c.children.length > 0 && ` Estimated annual CESG: $${Math.min(c.respAnnualContribution * 0.2 / Math.max(c.children.length, 1), 500) * Math.max(c.children.length, 1)}.`}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Government Benefits (CPP/OAS) */}
      <Card title="Government Benefits">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Estimated CPP at 65 (monthly)">
            <div className="flex gap-2">
              <CurrencyInput
                value={c.projectionParams.estimatedCppMonthly}
                onChange={(v) => handleField('projectionParams.estimatedCppMonthly', v)}
                onBlur={handleBlur}
                placeholder="$1,000.00"
              />
              <button
                type="button"
                onClick={() => {
                  const est = estimateCppMonthlyAt65(c.annualIncome);
                  handleField('projectionParams.estimatedCppMonthly', est);
                }}
                className="shrink-0 px-3 py-2 rounded-lg bg-navy/10 text-navy text-xs font-medium hover:bg-navy/20 transition-colors"
                title="Estimate CPP based on current annual income"
              >
                Estimate
              </button>
            </div>
            {c.annualIncome > 0 && (
              <p className="text-xs text-text-tertiary mt-1">
                Based on ${c.annualIncome.toLocaleString()} income: ~${estimateCppMonthlyAt65(c.annualIncome).toLocaleString()}/mo
              </p>
            )}
          </Field>
          <Field label="CPP Start Age">
            <input
              type="number"
              min={60}
              max={70}
              value={c.projectionParams.cppStartAge}
              onChange={(e) => handleField('projectionParams.cppStartAge', parseInt(e.target.value) || 65)}
              className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
            />
          </Field>
          <Field label="OAS Start Age">
            <input
              type="number"
              min={65}
              max={70}
              value={c.projectionParams.oasStartAge}
              onChange={(e) => handleField('projectionParams.oasStartAge', parseInt(e.target.value) || 65)}
              className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
            />
          </Field>
        </div>
      </Card>

      {/* Pension */}
      <Card title="Pension">
        <div className="space-y-4">
          <Field label="Pension Type">
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ['none', 'None'],
                  ['db', 'Defined Benefit (DB)'],
                  ['dc', 'Defined Contribution (DC)'],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={val}
                  className="inline-flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="pensionType"
                    value={val}
                    checked={c.pensionType === val}
                    onChange={() => handleField('pensionType', val)}
                    className="h-4 w-4 text-accent border-card-border focus:ring-accent/30"
                  />
                  <span className="text-sm text-text-primary">{label}</span>
                </label>
              ))}
            </div>
          </Field>

          {c.pensionType === 'db' && (
            <div className="pt-2 border-t border-card-border">
              <Field label="Annual Pension Estimate at Retirement">
                <CurrencyInput
                  value={c.pensionDetails?.annualBenefitEstimate ?? 0}
                  onChange={(v) =>
                    handleField('pension.annualBenefitEstimate', v)
                  }
                  onBlur={handleBlur}
                  placeholder="$30,000.00"
                />
              </Field>
            </div>
          )}

          {c.pensionType === 'dc' && (
            <div className="pt-2 border-t border-card-border grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Current DC Balance">
                <CurrencyInput
                  value={c.pensionDetails?.currentBalance ?? 0}
                  onChange={(v) => handleField('pension.currentBalance', v)}
                  onBlur={handleBlur}
                  placeholder="$100,000.00"
                />
              </Field>
              <Field label="DC Annual Contributions">
                <CurrencyInput
                  value={c.pensionDetails?.annualContribution ?? 0}
                  onChange={(v) => handleField('pension.annualContribution', v)}
                  onBlur={handleBlur}
                  placeholder="$5,000.00"
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      {/* Property & Debts */}
      <Card title="Property & Debts">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Primary Residence Value">
            <CurrencyInput
              value={c.primaryResidenceValue}
              onChange={(v) => handleField('primaryResidenceValue', v)}
              onBlur={handleBlur}
              placeholder="$500,000.00"
            />
          </Field>
          <Field label="Mortgage Balance">
            <CurrencyInput
              value={c.mortgageBalance}
              onChange={(v) => handleField('mortgageBalance', v)}
              onBlur={handleBlur}
              placeholder="$250,000.00"
            />
          </Field>
          <Field label="Other Debts">
            <CurrencyInput
              value={c.otherDebts}
              onChange={(v) => handleField('otherDebts', v)}
              onBlur={handleBlur}
              placeholder="$10,000.00"
            />
          </Field>
        </div>
        {c.mortgageBalance > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-card-border/60">
            <Field label="Mortgage Rate (%)">
              <input
                type="number"
                min={0}
                max={15}
                step={0.05}
                value={((c.mortgageRate ?? 0.05) * 100).toFixed(2)}
                onChange={(e) => handleField('mortgageRate', (parseFloat(e.target.value) || 5) / 100)}
                className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
              />
            </Field>
            <Field label="Remaining Amortization (years)">
              <input
                type="number"
                min={1}
                max={30}
                value={c.mortgageAmortizationYears ?? 25}
                onChange={(e) => handleField('mortgageAmortizationYears', parseInt(e.target.value) || 25)}
                className="w-full rounded-lg border border-card-border px-3 py-2 text-sm text-text-primary focus:border-navy focus:ring-1 focus:ring-navy/20"
              />
            </Field>
          </div>
        )}
      </Card>

      {/* Monthly Expenses */}
      <Card title="Living Expenses">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Field
              label={expensesAnnual ? 'Annual Expenses' : 'Monthly Expenses'}
              className="flex-1 mr-4"
            >
              <CurrencyInput
                value={
                  expensesAnnual
                    ? c.monthlyExpenses * 12
                    : c.monthlyExpenses
                }
                onChange={(v) => {
                  const monthly = expensesAnnual ? v / 12 : v;
                  handleField('monthlyExpenses', monthly);
                }}
                onBlur={handleBlur}
                placeholder={expensesAnnual ? '$60,000.00' : '$5,000.00'}
              />
            </Field>
            <div className="pt-5">
              <Toggle
                checked={expensesAnnual}
                onChange={setExpensesAnnual}
                label={expensesAnnual ? 'Annual' : 'Monthly'}
                id="expense-toggle"
              />
            </div>
          </div>
          {!expensesAnnual && c.monthlyExpenses > 0 && (
            <p className="text-xs text-text-secondary">
              Annual equivalent: {formatCurrency(c.monthlyExpenses * 12)}
            </p>
          )}
          {expensesAnnual && c.monthlyExpenses > 0 && (
            <p className="text-xs text-text-secondary">
              Monthly equivalent: {formatCurrency(c.monthlyExpenses)}
            </p>
          )}
        </div>
      </Card>
    </div>
  );

  // -----------------------------------------------------------------------
  // STEP 3: Insurance
  // -----------------------------------------------------------------------

  const renderInsuranceStep = () => (
    <div className="space-y-6">
      {/* Life Insurance */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-lg text-navy tracking-wide">Life Insurance</h3>
            <p className="text-sm text-text-secondary mt-0.5">
              Do you currently hold any life insurance?
            </p>
          </div>
          <Toggle
            checked={c.hasLifeInsurance}
            onChange={(v) => handleField('hasLifeInsurance', v)}
            label={c.hasLifeInsurance ? 'Yes' : 'No'}
            id="life-toggle"
          />
        </div>

        {c.hasLifeInsurance && (
          <div className="pt-4 border-t border-card-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Coverage Amount">
              <CurrencyInput
                value={c.lifeInsuranceDetails?.coverageAmount ?? 0}
                onChange={(v) => handleField('lifeIns.coverageAmount', v)}
                onBlur={handleBlur}
                placeholder="$500,000.00"
              />
            </Field>

            <Field label="Policy Type">
              <select
                value={c.lifeInsuranceDetails?.type ?? 'term'}
                onChange={(e) =>
                  handleField('lifeIns.type', e.target.value)
                }
                onBlur={handleBlur}
                className={selectClass}
              >
                <option value="term">Term</option>
                <option value="whole">Whole Life</option>
                <option value="universal">Universal Life</option>
              </select>
            </Field>

            <Field label="Source">
              <select
                value={c.lifeInsuranceDetails?.source ?? 'personal'}
                onChange={(e) =>
                  handleField('lifeIns.source', e.target.value)
                }
                onBlur={handleBlur}
                className={selectClass}
              >
                <option value="employer">Employer</option>
                <option value="personal">Personal</option>
                <option value="both">Both</option>
              </select>
            </Field>
          </div>
        )}
      </Card>

      {/* Disability Insurance */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-navy tracking-wide">
              Disability Insurance
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">
              Coverage that replaces income if you cannot work due to disability
            </p>
          </div>
          <Toggle
            checked={c.hasDisabilityInsurance}
            onChange={(v) => handleField('hasDisabilityInsurance', v)}
            label={c.hasDisabilityInsurance ? 'Yes' : 'No'}
            id="disability-toggle"
          />
        </div>
      </Card>

      {/* Critical Illness */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-navy tracking-wide">
              Critical Illness Insurance
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">
              Lump-sum payment upon diagnosis of a covered critical illness
            </p>
          </div>
          <Toggle
            checked={c.hasCriticalIllness}
            onChange={(v) => handleField('hasCriticalIllness', v)}
            label={c.hasCriticalIllness ? 'Yes' : 'No'}
            id="critical-toggle"
          />
        </div>
      </Card>

      {/* Insurance Summary */}
      <Card title="Insurance Summary">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className={`rounded-lg p-4 text-center ${
              c.hasLifeInsurance
                ? 'bg-positive/10 border border-positive/20'
                : 'bg-bg-secondary border border-card-border'
            }`}
          >
            <div className="text-2xl mb-1">
              {c.hasLifeInsurance ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 mx-auto text-positive"
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
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 mx-auto text-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 12H4"
                  />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-text-primary">Life</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {c.hasLifeInsurance
                ? formatCurrency(
                    c.lifeInsuranceDetails?.coverageAmount ?? 0,
                  )
                : 'Not held'}
            </p>
          </div>

          <div
            className={`rounded-lg p-4 text-center ${
              c.hasDisabilityInsurance
                ? 'bg-positive/10 border border-positive/20'
                : 'bg-bg-secondary border border-card-border'
            }`}
          >
            <div className="text-2xl mb-1">
              {c.hasDisabilityInsurance ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 mx-auto text-positive"
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
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 mx-auto text-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 12H4"
                  />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-text-primary">Disability</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {c.hasDisabilityInsurance ? 'Covered' : 'Not held'}
            </p>
          </div>

          <div
            className={`rounded-lg p-4 text-center ${
              c.hasCriticalIllness
                ? 'bg-positive/10 border border-positive/20'
                : 'bg-bg-secondary border border-card-border'
            }`}
          >
            <div className="text-2xl mb-1">
              {c.hasCriticalIllness ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 mx-auto text-positive"
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
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 mx-auto text-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 12H4"
                  />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-text-primary">
              Critical Illness
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {c.hasCriticalIllness ? 'Covered' : 'Not held'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-navy tracking-wide">Client Profile</h1>
        <p className="text-sm text-text-secondary mt-1">
          {c.firstName && c.lastName
            ? `${c.firstName} ${c.lastName}`
            : 'New Client'}{' '}
          &mdash; Capture core information for financial projections
        </p>
      </div>

      {/* Stepper */}
      <Stepper current={step} onStepClick={setStep} />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 0 && renderPersonalStep()}
        {step === 1 && renderFinancialStep()}
        {step === 2 && renderInsuranceStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-card-border">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            step === 0
              ? 'text-text-secondary/40 cursor-not-allowed'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary border border-card-border'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-2">
          {/* Step indicator dots (mobile) */}
          <div className="flex gap-1.5 sm:hidden mr-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-navy' : 'bg-card-border'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-navy hover:bg-navy-light transition-colors shadow-sm cursor-pointer"
          >
            {step === 2 ? (
              <>
                Next: Projections
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            ) : (
              <>
                Next: {STEPS[step + 1]}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
