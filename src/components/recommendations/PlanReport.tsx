import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { useClient } from '../../hooks/useClient';
import {
  generateProjections,
  calculateKeyMetrics,
  estimateEstateTaxBill,
  getMarginalTaxRate,
} from '../../lib/calculations';
import { calculateProbateFee, PROVINCE_NAMES } from '../../lib/constants';
import type { Client, ProjectionRow, KeyMetrics } from '../../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Narrative generators — these produce advisor-quality text
// ---------------------------------------------------------------------------

function generateExecutiveSummary(
  client: Client,
  metrics: KeyMetrics,
  projections: ProjectionRow[],
): string {
  const age = calculateAge(client.dateOfBirth) ?? 0;
  const yearsToRetirement = Math.max(0, client.projectionParams.retirementAge - age);
  const retirementRow = projections.find((r) => r.isRetired);
  const lastRow = projections[projections.length - 1];
  const hasSpouse = client.hasSpouse && client.spouse;
  const province = PROVINCE_NAMES[client.province] ?? client.province;

  let summary = `${client.firstName} ${client.lastName}`;
  if (hasSpouse) summary += ` and ${client.spouse!.firstName}`;
  summary += `, age ${age}`;
  if (hasSpouse) summary += ` and ${calculateAge(client.spouse!.dateOfBirth) ?? '—'}`;
  summary += `, residing in ${province}. `;

  if (yearsToRetirement > 0) {
    summary += `Target retirement at age ${client.projectionParams.retirementAge} (${yearsToRetirement} years from now). `;
  } else {
    summary += `Currently retired. `;
  }

  summary += `Current household income of ${fmt(client.annualIncome + (hasSpouse ? client.spouse!.annualIncome : 0))}/year with monthly expenses of ${fmt(client.monthlyExpenses)}. `;

  if (retirementRow) {
    summary += `At retirement, projected after-tax income of ${fmt(retirementRow.afterTaxIncome)}/year, `;
    summary += `representing a ${pct(metrics.incomeReplacementRatio)} income replacement ratio. `;
  }

  if (metrics.moneyLastsUntilAge === null) {
    summary += `Investment portfolio is projected to sustain through age 95`;
    if (lastRow && metrics.surplusAtAge95 != null && metrics.surplusAtAge95 > 0) {
      summary += ` with a surplus of ${fmt(metrics.surplusAtAge95)}`;
    }
    summary += `. `;
  } else {
    summary += `Warning: savings may be depleted by age ${metrics.moneyLastsUntilAge}. Adjustments are recommended. `;
  }

  return summary;
}

function generateRetirementSection(
  client: Client,
  metrics: KeyMetrics,
  projections: ProjectionRow[],
): string[] {
  const paragraphs: string[] = [];
  const retirementRow = projections.find((r) => r.isRetired);
  const hasSpouse = client.hasSpouse && client.spouse;

  // CPP analysis
  const cppAt65 = client.projectionParams.estimatedCppMonthly;
  const cppStartAge = client.projectionParams.cppStartAge;
  let cppText = `CPP is estimated at ${fmt(cppAt65 * 12)}/year ($${cppAt65}/month) at age 65`;
  if (cppStartAge !== 65) {
    const direction = cppStartAge < 65 ? 'reduced' : 'enhanced';
    cppText += `, ${direction} for commencement at age ${cppStartAge}`;
  }
  cppText += '. ';
  if (cppStartAge < 70) {
    cppText += 'Deferring CPP to age 70 would increase the monthly benefit by 42% (0.7% per month after 65). ';
  }
  if (hasSpouse) {
    const spouseCpp = client.spouse!.estimatedCppMonthly ?? 0;
    cppText += `Spouse's CPP is estimated at $${spouseCpp}/month starting at age ${client.spouse!.cppStartAge ?? 65}. `;
  }
  paragraphs.push(cppText);

  // OAS analysis
  const oasAge = client.projectionParams.oasStartAge;
  let oasText = `OAS commences at age ${oasAge}. `;
  if ((metrics.totalOasClawback ?? 0) > 0) {
    oasText += `OAS Recovery Tax (clawback) of ${fmt(metrics.totalOasClawback ?? 0)} is projected over ${metrics.oasClawbackYears ?? 0} years due to net income exceeding the $90,997 threshold. `;
    oasText += 'Strategies to reduce clawback include maximizing TFSA, pension income splitting, and controlling RRIF withdrawals. ';
  }
  paragraphs.push(oasText);

  // Income sources breakdown at retirement
  if (retirementRow) {
    const sources: string[] = [];
    if (retirementRow.cpp > 0) sources.push(`CPP: ${fmt(retirementRow.cpp)}`);
    if (retirementRow.oas > 0) sources.push(`OAS: ${fmt(retirementRow.oas)}`);
    if (retirementRow.pensionIncome > 0) sources.push(`Pension: ${fmt(retirementRow.pensionIncome)}`);
    if (retirementRow.rrspRrifWithdrawals > 0) sources.push(`RRSP/RRIF: ${fmt(retirementRow.rrspRrifWithdrawals)}`);
    paragraphs.push(`First year of retirement income sources: ${sources.join(', ')}. Government benefits (CPP + OAS) represent ${pct(metrics.cppOasPercentOfRetirementIncome)} of average retirement income.`);
  }

  return paragraphs;
}

function generateTaxSection(
  client: Client,
  metrics: KeyMetrics,
): string[] {
  const paragraphs: string[] = [];
  const province = PROVINCE_NAMES[client.province] ?? client.province;
  const marginalRate = getMarginalTaxRate(client.annualIncome, client.province);

  paragraphs.push(
    `Current combined marginal tax rate in ${province}: ${pct(marginalRate)}. Total lifetime tax (current to age 95) is projected at ${fmt(metrics.totalLifetimeTax)}. Average effective tax rate in retirement: ${pct(metrics.avgEffectiveTaxRate ?? 0)}.`,
  );

  // Tax optimization strategies
  const strategies: string[] = [];
  if (client.hasSpouse) {
    strategies.push('Pension income splitting (up to 50% of eligible pension income can be allocated to the lower-income spouse)');
    if (client.annualIncome > client.spouse!.annualIncome * 1.5) {
      strategies.push('Spousal RRSP contributions to equalize retirement income and reduce combined tax burden');
    }
  }
  strategies.push('Tax-optimized withdrawal sequencing: non-registered first, RRSP/RRIF to bracket targets, TFSA last');
  strategies.push('TFSA maximization to create tax-free retirement income and reduce OAS clawback exposure');
  if (client.rrspAnnualContribution < client.annualIncome * 0.18) {
    strategies.push('Increase RRSP contributions to maximize deductions at the current marginal rate');
  }

  paragraphs.push(`Tax optimization strategies: ${strategies.join('; ')}.`);

  return paragraphs;
}

function generateEstateSection(
  client: Client,
  projections: ProjectionRow[],
): string[] {
  const paragraphs: string[] = [];
  const lastRow = projections[projections.length - 1];
  if (!lastRow) return paragraphs;

  const hasSpouse = client.hasSpouse;

  // Estate tax
  const estateTax = estimateEstateTaxBill(
    lastRow.rrspRrifBalance,
    lastRow.nonRegBalance,
    lastRow.nonRegAcb ?? lastRow.nonRegBalance * 0.5,
    client.province,
    false, // Calculate terminal tax (second death or single)
  );

  if (hasSpouse) {
    paragraphs.push(
      `At first death, registered accounts (RRSP/RRIF) and TFSA can roll over to the surviving spouse tax-free. At second death (or if no surviving spouse), CRA deems all assets disposed. Estimated terminal tax bill: ${fmt(estateTax.totalTax)} (RRSP/RRIF income tax: ${fmt(estateTax.rrspTax)}, capital gains tax: ${fmt(estateTax.capitalGainsTax)}). Effective estate tax rate: ${pct(estateTax.effectiveRate)}.`,
    );
  } else {
    paragraphs.push(
      `At death, CRA deems all assets disposed. Estimated terminal tax bill: ${fmt(estateTax.totalTax)}. This includes full RRSP/RRIF balance as income and capital gains on non-registered investments.`,
    );
  }

  // Probate
  const probateFee = calculateProbateFee(client.province, lastRow.netWorth);
  if (probateFee > 0) {
    paragraphs.push(
      `Estimated probate fees on a ${fmt(lastRow.netWorth)} estate in ${PROVINCE_NAMES[client.province] ?? client.province}: ${fmt(probateFee)}. Joint ownership, beneficiary designations on registered accounts, and inter vivos trusts can reduce or eliminate probate fees.`,
    );
  }

  // Strategies
  paragraphs.push(
    'Estate planning recommendations: Ensure wills and powers of attorney are current. Review beneficiary designations on all registered accounts (RRSP, TFSA, insurance). Consider life insurance to cover the terminal tax bill. For large estates, explore the use of alter ego trusts or joint partner trusts to avoid probate.',
  );

  return paragraphs;
}

function generateInsuranceSection(client: Client): string[] {
  const paragraphs: string[] = [];
  const age = calculateAge(client.dateOfBirth) ?? 0;

  // Life insurance
  if (client.hasLifeInsurance && client.lifeInsuranceDetails) {
    const det = client.lifeInsuranceDetails;
    paragraphs.push(
      `Current life insurance: ${fmt(det.coverageAmount)} ${det.type} life policy (${det.source}). `,
    );
  } else if (client.annualIncome > 0 || client.mortgageBalance > 0) {
    const incomeNeed = client.annualIncome * 10;
    const debtNeed = client.mortgageBalance + client.otherDebts;
    paragraphs.push(
      `No life insurance on file. Capital needs analysis suggests coverage of approximately ${fmt(incomeNeed + debtNeed)} (10x income of ${fmt(incomeNeed)} plus debts of ${fmt(debtNeed)}).`,
    );
  }

  // Disability
  if (!client.hasDisabilityInsurance && age < 65 && client.annualIncome > 0) {
    paragraphs.push(
      `No disability insurance. Income protection gap of ${fmt(client.annualIncome)}/year. Disability is the most underestimated risk — approximately 1 in 3 workers will experience a disability lasting 90+ days before age 65.`,
    );
  }

  // Critical illness
  if (!client.hasCriticalIllness) {
    paragraphs.push(
      'No critical illness coverage. A CI policy provides a lump-sum benefit upon diagnosis of a covered condition (cancer, heart attack, stroke), which can cover treatment costs, income loss, and lifestyle modifications.',
    );
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
// Projection snapshot table (key years)
// ---------------------------------------------------------------------------

function getKeyYears(projections: ProjectionRow[]): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  const retirementIdx = projections.findIndex((r) => r.isRetired);

  // Current year
  if (projections.length > 0) rows.push(projections[0]);

  // Year before retirement
  if (retirementIdx > 1) rows.push(projections[retirementIdx - 1]);

  // First retirement year
  if (retirementIdx >= 0) rows.push(projections[retirementIdx]);

  // Every 5 years after retirement
  for (let i = retirementIdx + 5; i < projections.length; i += 5) {
    rows.push(projections[i]);
  }

  // Last year (age 95)
  const last = projections[projections.length - 1];
  if (last && !rows.includes(last)) rows.push(last);

  return rows;
}

// ---------------------------------------------------------------------------
// Main Report Component
// ---------------------------------------------------------------------------

export default function PlanReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Ensure client is loaded from DB (handles direct navigation)
  useClient();
  const { currentClient, practiceSettings } = useAppStore();

  const projections = useMemo(() => {
    if (!currentClient) return [];
    return generateProjections(currentClient);
  }, [currentClient]);

  const metrics = useMemo(() => {
    if (!currentClient || projections.length === 0) return null;
    return calculateKeyMetrics(projections, currentClient.projectionParams);
  }, [currentClient, projections]);

  if (!currentClient || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary text-sm">No client data available.</p>
      </div>
    );
  }

  const client = currentClient;
  const age = calculateAge(client.dateOfBirth) ?? 0;
  const keyYears = getKeyYears(projections);
  const province = PROVINCE_NAMES[client.province] ?? client.province;
  const totalSavings = client.rrspBalance + client.tfsaBalance + client.nonRegisteredInvestments + client.fhsaBalance;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 print:px-0 print:py-0 print:max-w-none">
      {/* Print button (no-print) */}
      <div className="no-print mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(`/client/${id}/summary`)}
          className="text-sm text-accent hover:text-accent-hover"
        >
          &larr; Back to Summary
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"
        >
          Print Report
        </button>
      </div>

      {/* ============================================================ */}
      {/*  REPORT CONTENT                                               */}
      {/* ============================================================ */}

      <div className="space-y-8 print:space-y-6">
        {/* Cover / Header */}
        <header className="text-center border-b-2 border-navy pb-6">
          <p className="text-xs tracking-[0.3em] uppercase text-text-tertiary mb-2">
            Confidential Financial Plan
          </p>
          <h1 className="font-serif text-3xl text-navy tracking-wide">
            {client.firstName} {client.lastName}
            {client.hasSpouse && client.spouse && ` & ${client.spouse.firstName} ${client.spouse.lastName}`}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Prepared {new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            {practiceSettings.firmName}
            {practiceSettings.advisorName && ` — ${practiceSettings.advisorName}`}
          </p>
        </header>

        {/* Executive Summary */}
        <Section title="Executive Summary">
          <p className="text-sm text-text-primary leading-relaxed">
            {generateExecutiveSummary(client, metrics, projections)}
          </p>
        </Section>

        {/* Current Financial Snapshot */}
        <Section title="Current Financial Position">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <SnapshotItem label="Age" value={`${age}`} />
            <SnapshotItem label="Province" value={province} />
            <SnapshotItem label="Household Income" value={fmt(client.annualIncome + (client.spouse?.annualIncome ?? 0))} />
            <SnapshotItem label="Monthly Expenses" value={fmt(client.monthlyExpenses)} />
            <SnapshotItem label="Target Retirement" value={`Age ${client.projectionParams.retirementAge}`} />
            <SnapshotItem label="Total Savings" value={fmt(totalSavings)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-card-border/60">
            <SnapshotItem label="RRSP" value={fmt(client.rrspBalance)} small />
            <SnapshotItem label="TFSA" value={fmt(client.tfsaBalance)} small />
            <SnapshotItem label="Non-Registered" value={fmt(client.nonRegisteredInvestments)} small />
            <SnapshotItem label="FHSA" value={fmt(client.fhsaBalance)} small />
            <SnapshotItem label="Primary Residence" value={fmt(client.primaryResidenceValue)} small />
            <SnapshotItem label="Mortgage" value={fmt(client.mortgageBalance)} small />
            <SnapshotItem label="Other Debts" value={fmt(client.otherDebts)} small />
            <SnapshotItem
              label="Net Worth (est.)"
              value={fmt(totalSavings + client.primaryResidenceValue - client.mortgageBalance - client.otherDebts)}
              small
            />
          </div>
        </Section>

        {/* Key Metrics */}
        <Section title="Plan Health Metrics">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Income Replacement"
              value={pct(metrics.incomeReplacementRatio)}
              status={metrics.incomeReplacementRatio >= 0.7 ? 'good' : metrics.incomeReplacementRatio >= 0.5 ? 'caution' : 'concern'}
            />
            <MetricCard
              label="Money Lasts Until"
              value={metrics.moneyLastsUntilAge === null ? 'Age 95+' : `Age ${metrics.moneyLastsUntilAge}`}
              status={metrics.moneyLastsUntilAge === null ? 'good' : metrics.moneyLastsUntilAge >= 90 ? 'good' : 'concern'}
            />
            <MetricCard
              label="Surplus at 95"
              value={metrics.surplusAtAge95 != null ? fmt(metrics.surplusAtAge95) : 'N/A'}
              status={metrics.surplusAtAge95 != null && metrics.surplusAtAge95 > 0 ? 'good' : 'concern'}
            />
            <MetricCard label="Lifetime Tax" value={fmt(metrics.totalLifetimeTax)} status="neutral" />
            <MetricCard label="Avg Tax Rate (Ret.)" value={pct(metrics.avgEffectiveTaxRate ?? 0)} status="neutral" />
            <MetricCard
              label="OAS Clawback"
              value={fmt(metrics.totalOasClawback ?? 0)}
              status={(metrics.totalOasClawback ?? 0) > 0 ? 'caution' : 'good'}
            />
          </div>
        </Section>

        {/* Retirement Income Analysis */}
        <Section title="Retirement Income Analysis">
          {generateRetirementSection(client, metrics, projections).map((p, i) => (
            <p key={i} className="text-sm text-text-primary leading-relaxed mb-3">
              {p}
            </p>
          ))}
        </Section>

        {/* Projection Snapshot Table */}
        <Section title="Financial Projection — Key Years">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-navy">
                  <th className="text-left py-2 pr-2 font-semibold text-navy">Age</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">Income</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">CPP</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">OAS</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">Tax</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">After-Tax</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">Expenses</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">RRSP/RRIF</th>
                  <th className="text-right py-2 px-2 font-semibold text-navy">TFSA</th>
                  <th className="text-right py-2 pl-2 font-semibold text-navy">Net Worth</th>
                </tr>
              </thead>
              <tbody>
                {keyYears.map((row, i) => (
                  <tr
                    key={row.year}
                    className={`border-b border-card-border/40 ${row.isRetired && !keyYears[i - 1]?.isRetired ? 'bg-accent/5 font-medium' : ''}`}
                  >
                    <td className="py-1.5 pr-2 tabular-nums">
                      {row.age}
                      {row.isRetired && !keyYears[i - 1]?.isRetired && (
                        <span className="ml-1 text-[10px] text-accent font-semibold">RET</span>
                      )}
                    </td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{row.employmentIncome > 0 ? fmt(row.employmentIncome) : '—'}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{row.cpp > 0 ? fmt(row.cpp) : '—'}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{row.oas > 0 ? fmt(row.oas) : '—'}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{fmt(row.incomeTax)}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{fmt(row.afterTaxIncome)}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{fmt(row.expenses)}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{fmt(row.rrspRrifBalance)}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{fmt(row.tfsaBalance)}</td>
                    <td className="text-right py-1.5 pl-2 tabular-nums font-medium">{fmt(row.netWorth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Tax Strategy */}
        <Section title="Tax Planning Strategy">
          {generateTaxSection(client, metrics).map((p, i) => (
            <p key={i} className="text-sm text-text-primary leading-relaxed mb-3">
              {p}
            </p>
          ))}
        </Section>

        {/* Insurance Review */}
        <Section title="Insurance Review">
          {generateInsuranceSection(client).map((p, i) => (
            <p key={i} className="text-sm text-text-primary leading-relaxed mb-3">
              {p}
            </p>
          ))}
        </Section>

        {/* Estate Planning */}
        <Section title="Estate Planning">
          {generateEstateSection(client, projections).map((p, i) => (
            <p key={i} className="text-sm text-text-primary leading-relaxed mb-3">
              {p}
            </p>
          ))}
        </Section>

        {/* Action Items */}
        {client.actionItems.length > 0 && (
          <Section title="Recommended Action Items">
            <ol className="list-decimal list-inside space-y-2">
              {client.actionItems
                .filter((a) => !a.completed)
                .map((item) => (
                  <li key={item.id} className="text-sm text-text-primary">
                    {item.text}
                    <span className="ml-2 text-xs text-text-tertiary">({item.category})</span>
                  </li>
                ))}
            </ol>
          </Section>
        )}

        {/* Advisor Notes */}
        {client.advisorNotes && (
          <Section title="Advisor Notes">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {client.advisorNotes}
            </p>
          </Section>
        )}

        {/* Disclaimer */}
        <footer className="border-t-2 border-navy pt-4 mt-8">
          <p className="text-[10px] text-text-tertiary leading-relaxed">
            <strong>Disclaimer:</strong> This financial plan is based on the information provided and current assumptions
            regarding tax rates, government benefits, and investment returns. Actual results will vary based on market
            conditions, legislative changes, and personal circumstances. This plan does not constitute financial, tax,
            or legal advice. Please consult with qualified professionals before making financial decisions. Projections
            are hypothetical and do not guarantee future results. Government benefit amounts (CPP, OAS, GIS) are
            estimates based on 2025 rates and may change. Tax calculations are simplified and do not account for all
            credits, deductions, or provincial surtaxes.
          </p>
          <p className="text-[10px] text-text-tertiary mt-2">
            Generated by {practiceSettings.firmName} &mdash; {new Date().toLocaleDateString('en-CA')}
          </p>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print:break-inside-avoid">
      <h2 className="font-serif text-lg text-navy tracking-wide border-b border-card-border pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SnapshotItem({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p className={`text-text-tertiary tracking-wider uppercase ${small ? 'text-[10px]' : 'text-[11px]'}`}>
        {label}
      </p>
      <p className={`tabular-nums text-text-primary ${small ? 'text-sm' : 'text-base font-medium'}`}>
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: 'good' | 'caution' | 'concern' | 'neutral';
}) {
  const borderColor =
    status === 'good'
      ? 'border-l-positive'
      : status === 'caution'
        ? 'border-l-warning'
        : status === 'concern'
          ? 'border-l-negative'
          : 'border-l-card-border';

  return (
    <div className={`border border-card-border rounded-lg p-3 border-l-4 ${borderColor}`}>
      <p className="text-[10px] text-text-tertiary tracking-wider uppercase">{label}</p>
      <p className="text-base font-semibold tabular-nums text-text-primary mt-0.5">{value}</p>
    </div>
  );
}
