import { useState, useEffect, useMemo, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store';
import { generateProjections, calculateKeyMetrics, estimateEstateTaxBill } from '../../lib/calculations';
import { calculateProbateFee } from '../../lib/constants';
import type {
  Client,
  ActionItem,
  ProjectionRow,
  KeyMetrics,
} from '../../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Finding generation
// ---------------------------------------------------------------------------

function generateFindings(
  client: Client,
  projections: ProjectionRow[],
  metrics: KeyMetrics,
): string[] {
  const findings: string[] = [];

  // 1. Retirement feasibility from first retirement year projection
  const retirementRow = projections.find((r) => r.isRetired);
  if (retirementRow) {
    findings.push(
      `Based on current savings rate, retirement at age ${retirementRow.age} is feasible with ${formatCurrency(retirementRow.afterTaxIncome)}/year after-tax income.`,
    );
  }

  // 2. CPP deferral comparison: current start age vs age 70
  const currentCppAge = client.projectionParams.cppStartAge;
  if (currentCppAge < 70) {
    const monthlyAtCurrent = client.projectionParams.estimatedCppMonthly;
    // Enhancement: 0.7% per month after 65 (8.4%/yr)
    // Reduction: 0.6% per month before 65 (7.2%/yr)
    let adjusted65 = monthlyAtCurrent;
    if (currentCppAge < 65) {
      const reductionMonths = (65 - currentCppAge) * 12;
      adjusted65 = monthlyAtCurrent / (1 - reductionMonths * 0.006);
    } else if (currentCppAge > 65) {
      const enhanceMonths = (currentCppAge - 65) * 12;
      adjusted65 = monthlyAtCurrent / (1 + enhanceMonths * 0.007);
    }
    const monthlyAt70 = adjusted65 * (1 + 60 * 0.007); // 60 months after 65
    const annualCurrent = monthlyAtCurrent * 12;
    const annualAt70 = monthlyAt70 * 12;
    // Estimate lifetime difference: collect fewer years at 70 but higher amount
    // Assume life expectancy ~90 for comparison
    const yearsCollectCurrent = 90 - currentCppAge;
    const yearsCollect70 = 90 - 70;
    const lifetimeCurrent = annualCurrent * yearsCollectCurrent;
    const lifetime70 = annualAt70 * yearsCollect70;
    const diff = lifetime70 - lifetimeCurrent;
    if (diff > 0) {
      findings.push(
        `Delaying CPP to age 70 increases lifetime benefits by approximately ${formatCurrency(diff)}.`,
      );
    }
  }

  // 3. RRSP contribution optimization
  const maxContribution = Math.min(client.annualIncome * 0.18, 32490);
  if (
    client.annualIncome > 0 &&
    client.rrspAnnualContribution < maxContribution &&
    client.rrspAnnualContribution < client.annualIncome * 0.18
  ) {
    const gap = maxContribution - client.rrspAnnualContribution;
    // Estimate marginal tax rate (rough) for tax savings
    const marginalRate =
      client.annualIncome > 220000
        ? 0.53
        : client.annualIncome > 150000
          ? 0.46
          : client.annualIncome > 100000
            ? 0.37
            : client.annualIncome > 55000
              ? 0.30
              : 0.20;
    const taxSaved = Math.round(gap * marginalRate);
    findings.push(
      `Current RRSP contributions are below optimal \u2014 increasing by ${formatCurrency(gap)}/year would save ${formatCurrency(taxSaved)} in taxes.`,
    );
  }

  // 4. Disability insurance gap
  if (!client.hasDisabilityInsurance && client.annualIncome > 0) {
    findings.push(
      `No disability insurance \u2014 income protection gap of ${formatCurrency(client.annualIncome)}/year if unable to work.`,
    );
  }

  // 5. Estate planning check
  const hasEstatePriority = client.priorities.some(
    (p) => p.category === 'Estate Planning',
  );
  const estateInRanking = client.priorityRanking.includes('Estate Planning');
  if (!hasEstatePriority && !estateInRanking) {
    findings.push(
      'No will or POA on file \u2014 estate planning review recommended.',
    );
  }

  // 6. Critical illness coverage
  if (!client.hasCriticalIllness) {
    findings.push('No critical illness coverage in place.');
  }

  // 7. Money-lasts-until metric
  if (metrics.moneyLastsUntilAge !== null && metrics.moneyLastsUntilAge < 95) {
    findings.push(
      `At current trajectory, savings may be depleted by age ${metrics.moneyLastsUntilAge}. Consider adjustments to extend portfolio longevity.`,
    );
  }

  // 8. Surplus at 95
  if (metrics.surplusAtAge95 !== null && metrics.surplusAtAge95 > 0) {
    findings.push(
      `Projected surplus of ${formatCurrency(metrics.surplusAtAge95)} at age 95 \u2014 strong financial position.`,
    );
  }

  // 9. OAS clawback
  if ((metrics.totalOasClawback ?? 0) > 0) {
    findings.push(
      `OAS clawback of ${formatCurrency(metrics.totalOasClawback ?? 0)} projected over ${metrics.oasClawbackYears ?? 0} years. Consider strategies to reduce taxable income below the $90,997 threshold.`,
    );
  }

  // 10. Effective tax rate
  if ((metrics.avgEffectiveTaxRate ?? 0) > 0.30) {
    findings.push(
      `Average effective tax rate of ${((metrics.avgEffectiveTaxRate ?? 0) * 100).toFixed(1)}% in retirement is high. Tax optimization through pension splitting, TFSA utilization, and withdrawal sequencing could reduce this.`,
    );
  }

  // 11. TFSA maximization
  if (client.tfsaAnnualContribution < 7000 && client.annualIncome > 0) {
    findings.push(
      `TFSA contributions of ${formatCurrency(client.tfsaAnnualContribution)}/year are below the $7,000 annual limit. Maximizing TFSA contributions provides tax-free retirement income and reduces future OAS clawback risk.`,
    );
  }

  // 12. Estate probate fee estimate
  const lastRow = projections[projections.length - 1];
  if (lastRow && lastRow.netWorth > 100000) {
    const probateFee = calculateProbateFee(client.province, lastRow.netWorth);
    if (probateFee > 500) {
      findings.push(
        `Estimated probate fees of ${formatCurrency(probateFee)} on a ${formatCurrency(lastRow.netWorth)} estate in ${client.province}. Joint ownership, beneficiary designations, and trusts can reduce or eliminate probate.`,
      );
    }
  }

  // 12b. Estate deemed disposition tax estimate
  if (lastRow) {
    const estateTax = estimateEstateTaxBill(
      lastRow.rrspRrifBalance,
      lastRow.nonRegBalance,
      lastRow.nonRegAcb ?? lastRow.nonRegBalance * 0.5,
      client.province,
      client.hasSpouse,
    );
    if (estateTax.totalTax > 0) {
      findings.push(
        `Estate deemed disposition tax estimated at ${formatCurrency(estateTax.totalTax)} (RRSP/RRIF: ${formatCurrency(estateTax.rrspTax)}, capital gains: ${formatCurrency(estateTax.capitalGainsTax)}). Effective rate: ${(estateTax.effectiveRate * 100).toFixed(1)}%. Life insurance or gradual RRSP drawdowns can reduce this liability.`,
      );
    } else if (client.hasSpouse) {
      findings.push(
        `With spousal rollover, registered accounts transfer tax-free at first death. Plan for the terminal tax bill at second death.`,
      );
    }
  }

  // 13. FHSA utilization
  if (client.fhsaBalance > 0 || client.fhsaAnnualContribution > 0) {
    const yearsToRetirement = Math.max(0, client.projectionParams.retirementAge - (new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()));
    const projectedFhsa = Math.min(40000, client.fhsaBalance + client.fhsaAnnualContribution * yearsToRetirement);
    findings.push(
      `FHSA balance will transfer to RRSP at retirement (projected ${formatCurrency(projectedFhsa)}). This transfer is tax-free and does not use RRSP room.`,
    );
  }

  // 14. Spouse income splitting opportunity
  if (client.hasSpouse && client.spouse && client.annualIncome > 100000) {
    const spouseIncome = client.spouse.annualIncome;
    if (spouseIncome < client.annualIncome * 0.5) {
      findings.push(
        `Significant income disparity with spouse — spousal RRSP contributions and pension splitting at retirement can substantially reduce household taxes.`,
      );
    }
  }

  // 15. RESP/CESG for families with children
  if (client.children.length > 0) {
    if (client.respAnnualContribution === 0) {
      findings.push(
        `${client.children.length} child${client.children.length > 1 ? 'ren' : ''} registered but no RESP contributions. Contributing $2,500/year per child qualifies for $500/year CESG match — free government money.`,
      );
    } else if (client.respAnnualContribution < client.children.length * 2500) {
      const idealContrib = client.children.length * 2500;
      findings.push(
        `RESP contributions of ${formatCurrency(client.respAnnualContribution)}/year are below the ${formatCurrency(idealContrib)} needed to maximize CESG matching ($500/year per child).`,
      );
    }
  }

  // 16. Capital gains inclusion rate warning for large non-reg portfolios
  if (client.nonRegisteredInvestments > 500000) {
    findings.push(
      `Non-registered portfolio of ${formatCurrency(client.nonRegisteredInvestments)} may trigger the enhanced capital gains inclusion rate (66.67%) on gains exceeding $250,000. Consider crystallizing gains gradually or using tax-loss harvesting strategies.`,
    );
  }

  // 17. RRSP deduction room utilization
  if (client.rrspDeductionRoom > 0 && client.rrspAnnualContribution > 0) {
    const yearsToUse = Math.ceil(client.rrspDeductionRoom / client.rrspAnnualContribution);
    if (yearsToUse > 5) {
      findings.push(
        `RRSP deduction room of ${formatCurrency(client.rrspDeductionRoom)} at current contribution of ${formatCurrency(client.rrspAnnualContribution)}/year will take ~${yearsToUse} years to utilize. Consider a lump-sum contribution or increasing annual contributions while marginal tax rate is high.`,
      );
    }
  } else if (client.rrspDeductionRoom > 20000 && client.rrspAnnualContribution === 0) {
    findings.push(
      `${formatCurrency(client.rrspDeductionRoom)} in unused RRSP deduction room. This is a significant tax-sheltering opportunity being missed.`,
    );
  }

  // 18. Mortgage vs RRSP decision
  if (client.mortgageBalance > 0 && client.mortgageRate > 0) {
    const afterTaxRate = client.projectionParams.rrspReturnRate;
    if (client.mortgageRate > afterTaxRate) {
      findings.push(
        `Mortgage rate of ${(client.mortgageRate * 100).toFixed(1)}% exceeds expected investment return of ${(afterTaxRate * 100).toFixed(1)}%. Prioritizing mortgage paydown may be more effective than additional RRSP contributions.`,
      );
    }
  }

  // 19. Life insurance capital needs analysis
  if (!client.hasLifeInsurance && client.annualIncome > 0) {
    const capitalNeed = client.annualIncome * 10 + client.mortgageBalance + client.otherDebts;
    findings.push(
      `No life insurance on file. Estimated capital need: ${formatCurrency(capitalNeed)} (10x income + debts). Term life coverage should be reviewed.`,
    );
  }

  // 20. Pension income splitting opportunity at retirement
  if (client.hasSpouse && client.pensionType !== 'none') {
    const retRows = projections.filter(r => r.isRetired && (r.pensionSplitSavings ?? 0) > 0);
    if (retRows.length > 0) {
      const totalSplitSavings = retRows.reduce((s, r) => s + (r.pensionSplitSavings ?? 0), 0);
      findings.push(
        `Pension income splitting projected to save ${formatCurrency(totalSplitSavings)} in total taxes over retirement. Ensure T1032 form is filed annually.`,
      );
    }
  }

  // 21. Debt-to-asset ratio check
  const totalDebts = client.mortgageBalance + client.otherDebts;
  const totalAssets = client.rrspBalance + client.tfsaBalance + client.nonRegisteredInvestments + client.primaryResidenceValue;
  if (totalAssets > 0 && totalDebts / totalAssets > 0.5) {
    findings.push(
      `Debt-to-asset ratio of ${((totalDebts / totalAssets) * 100).toFixed(0)}% is elevated. Focus on debt reduction before retirement to lower fixed costs.`,
    );
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Default action items from gaps
// ---------------------------------------------------------------------------

function generateDefaultActionItems(client: Client, metrics?: KeyMetrics): ActionItem[] {
  const items: ActionItem[] = [];

  if (!client.hasDisabilityInsurance) {
    items.push({
      id: uuidv4(),
      text: 'Review disability insurance options and obtain quotes',
      completed: false,
      category: 'Insurance',
    });
  }

  if (!client.hasCriticalIllness) {
    items.push({
      id: uuidv4(),
      text: 'Evaluate critical illness insurance needs and coverage options',
      completed: false,
      category: 'Insurance',
    });
  }

  const hasEstatePriority = client.priorities.some(
    (p) => p.category === 'Estate Planning',
  );
  if (!hasEstatePriority) {
    items.push({
      id: uuidv4(),
      text: 'Schedule estate planning review \u2014 will, POA, and beneficiary designations',
      completed: false,
      category: 'Estate',
    });
  }

  const maxRrsp = Math.min(client.annualIncome * 0.18, 32490);
  if (
    client.annualIncome > 0 &&
    client.rrspAnnualContribution < maxRrsp * 0.8
  ) {
    items.push({
      id: uuidv4(),
      text: `Increase RRSP contributions toward the ${formatCurrency(maxRrsp)} annual limit`,
      completed: false,
      category: 'Savings',
    });
  }

  if (client.tfsaAnnualContribution < 7000 && client.annualIncome > 0) {
    items.push({
      id: uuidv4(),
      text: 'Maximize TFSA contributions ($7,000 annual room)',
      completed: false,
      category: 'Savings',
    });
  }

  if (client.mortgageBalance > 0 && client.otherDebts > 0) {
    items.push({
      id: uuidv4(),
      text: 'Develop debt reduction strategy for non-mortgage liabilities',
      completed: false,
      category: 'Debt',
    });
  }

  if (!client.hasLifeInsurance && client.hasSpouse) {
    items.push({
      id: uuidv4(),
      text: 'Evaluate life insurance needs for income replacement and mortgage protection',
      completed: false,
      category: 'Insurance',
    });
  }

  if (client.projectionParams.cppStartAge < 70) {
    items.push({
      id: uuidv4(),
      text: 'Analyze optimal CPP start age \u2014 consider deferral to age 70 for higher benefits',
      completed: false,
      category: 'Retirement',
    });
  }

  if (metrics && (metrics.totalOasClawback ?? 0) > 0) {
    items.push({
      id: uuidv4(),
      text: 'Review income splitting and TFSA strategies to minimize OAS clawback',
      completed: false,
      category: 'Tax',
    });
  }

  if (metrics && (metrics.avgEffectiveTaxRate ?? 0) > 0.25) {
    items.push({
      id: uuidv4(),
      text: 'Consider tax-efficient withdrawal sequencing to reduce effective tax rate',
      completed: false,
      category: 'Tax',
    });
  }

  if (client.rrspDeductionRoom > 20000) {
    items.push({
      id: uuidv4(),
      text: `Utilize ${formatCurrency(client.rrspDeductionRoom)} RRSP deduction room — consider lump-sum contribution or increased annual amount`,
      completed: false,
      category: 'Savings',
    });
  }

  if (client.mortgageBalance > 0 && client.mortgageRate > 0.05) {
    items.push({
      id: uuidv4(),
      text: 'Review mortgage renewal options — explore prepayment or refinancing at lower rate',
      completed: false,
      category: 'Debt',
    });
  }

  if (client.hasSpouse && client.spouse && !client.spouse.rrspBalance && !client.spouse.tfsaBalance) {
    items.push({
      id: uuidv4(),
      text: "Review spouse's registered account contributions — consider spousal RRSP for income splitting",
      completed: false,
      category: 'Tax',
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Plain-text summary for clipboard
// ---------------------------------------------------------------------------

function generatePlainTextSummary(
  client: Client,
  findings: string[],
  actionItems: ActionItem[],
): string {
  const lines: string[] = [];
  const sep = '='.repeat(60);

  lines.push(sep);
  lines.push(
    `FINANCIAL PLAN SUMMARY \u2014 ${client.firstName} ${client.lastName}`,
  );
  lines.push(`Generated: ${new Date().toLocaleDateString('en-CA')}`);
  lines.push(sep);

  // Priorities
  if (client.priorityRanking.length > 0) {
    lines.push('');
    lines.push('PRIORITIES');
    lines.push('-'.repeat(30));
    client.priorityRanking.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p}`);
    });
  }

  // Key findings
  if (findings.length > 0) {
    lines.push('');
    lines.push('KEY FINDINGS');
    lines.push('-'.repeat(30));
    findings.forEach((f) => {
      lines.push(`  \u2022 ${f}`);
    });
  }

  // Action items
  const incomplete = actionItems.filter((a) => !a.completed);
  const completed = actionItems.filter((a) => a.completed);

  if (incomplete.length > 0 || completed.length > 0) {
    lines.push('');
    lines.push('ACTION ITEMS');
    lines.push('-'.repeat(30));
    incomplete.forEach((a) => {
      lines.push(`  [ ] ${a.text} (${a.category})`);
    });
    completed.forEach((a) => {
      lines.push(`  [x] ${a.text} (${a.category})`);
    });
  }

  // Advisor notes
  if (client.advisorNotes) {
    lines.push('');
    lines.push('ADVISOR NOTES');
    lines.push('-'.repeat(30));
    lines.push(client.advisorNotes);
  }

  lines.push('');
  lines.push(sep);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Icons (inline SVG components)
// ---------------------------------------------------------------------------

function InfoIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 9v5m0-8h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WarningIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 2L1 18h18L10 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 8v4m0 2h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1m2 0v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PrinterIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.5 6V1.5h9V6M4.5 13.5H3a1.5 1.5 0 01-1.5-1.5V8.25A1.5 1.5 0 013 6.75h12a1.5 1.5 0 011.5 1.5V12a1.5 1.5 0 01-1.5 1.5h-1.5m-9 0v3h9v-3h-9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClipboardIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="5.25"
        y="2.25"
        width="7.5"
        height="3"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.25 4.5H4.5a1.5 1.5 0 00-1.5 1.5v9a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5h-.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Finding card
// ---------------------------------------------------------------------------

function isWarningFinding(text: string): boolean {
  const warningKeywords = [
    'no disability',
    'no will',
    'no poa',
    'no critical illness',
    'below optimal',
    'depleted',
    'gap of',
    'no life insurance',
    'no coverage',
  ];
  const lower = text.toLowerCase();
  return warningKeywords.some((kw) => lower.includes(kw));
}

function FindingCard({ text }: { text: string }) {
  const isWarning = isWarningFinding(text);

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        isWarning
          ? 'border-warning/30 bg-warning/5'
          : 'border-accent/20 bg-accent/5'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {isWarning ? (
          <WarningIcon className="text-warning" />
        ) : (
          <InfoIcon className="text-accent" />
        )}
      </div>
      <p className="text-sm leading-relaxed text-text-primary">{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Action item row
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Insurance: 'bg-blue-100 text-blue-800',
  Estate: 'bg-purple-100 text-purple-800',
  Savings: 'bg-emerald-100 text-emerald-800',
  Debt: 'bg-red-100 text-red-800',
  Retirement: 'bg-amber-100 text-amber-800',
  Tax: 'bg-orange-100 text-orange-800',
  Other: 'bg-gray-100 text-gray-700',
};

interface ActionItemRowProps {
  item: ActionItem;
  onToggle: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

function ActionItemRow({
  item,
  onToggle,
  onUpdate,
  onDelete,
}: ActionItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);

  const handleBlur = () => {
    setIsEditing(false);
    if (editText.trim() && editText !== item.text) {
      onUpdate(item.id, editText.trim());
    } else {
      setEditText(item.text);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      setEditText(item.text);
      setIsEditing(false);
    }
  };

  const colorClass =
    CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS['Other'];

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border border-card-border px-4 py-3 transition-colors hover:bg-bg-secondary ${
        item.completed ? 'opacity-60' : ''
      }`}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          item.completed
            ? 'border-positive bg-positive text-white'
            : 'border-gray-300 hover:border-accent'
        }`}
        aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {item.completed && <CheckIcon className="h-3 w-3" />}
      </button>

      {/* Text */}
      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="min-w-0 flex-1 rounded border border-accent/30 bg-white px-2 py-1 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`min-w-0 flex-1 cursor-text text-sm ${
            item.completed ? 'line-through text-text-secondary' : 'text-text-primary'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setIsEditing(true);
          }}
          title="Click to edit"
        >
          {item.text}
        </span>
      )}

      {/* Category badge */}
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      >
        {item.category}
      </span>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="shrink-0 rounded p-1 text-text-secondary opacity-0 transition-all hover:bg-negative/10 hover:text-negative group-hover:opacity-100"
        aria-label="Delete action item"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Summary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClient, updateClient } = useAppStore();

  // Local state
  const [advisorNotes, setAdvisorNotes] = useState('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Other');
  const [copySuccess, setCopySuccess] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Compute projections and metrics
  const { projections, metrics } = useMemo(() => {
    if (!currentClient) {
      return {
        projections: [] as ProjectionRow[],
        metrics: {
          incomeReplacementRatio: 0,
          moneyLastsUntilAge: null,
          surplusAtAge95: null,
          totalLifetimeTax: 0,
          cppOasPercentOfRetirementIncome: 0,
        } as KeyMetrics,
      };
    }
    try {
      const proj = generateProjections(currentClient);
      const met = calculateKeyMetrics(proj, currentClient.projectionParams);
      return { projections: proj, metrics: met };
    } catch {
      return {
        projections: [] as ProjectionRow[],
        metrics: {
          incomeReplacementRatio: 0,
          moneyLastsUntilAge: null,
          surplusAtAge95: null,
          totalLifetimeTax: 0,
          cppOasPercentOfRetirementIncome: 0,
        } as KeyMetrics,
      };
    }
  }, [currentClient]);

  // Findings
  const findings = useMemo(() => {
    if (!currentClient) return [];
    return generateFindings(currentClient, projections, metrics);
  }, [currentClient, projections, metrics]);

  // Initialize action items and notes from client
  useEffect(() => {
    if (!currentClient || initialized) return;

    setAdvisorNotes(currentClient.advisorNotes || '');

    // Merge existing action items with auto-generated defaults
    const existing = currentClient.actionItems || [];
    const defaults = generateDefaultActionItems(currentClient, metrics);

    // Only add defaults that are not already represented
    const existingTexts = new Set(
      existing.map((a) => a.text.toLowerCase().slice(0, 40)),
    );
    const mergedDefaults = defaults.filter(
      (d) => !existingTexts.has(d.text.toLowerCase().slice(0, 40)),
    );

    setActionItems([...existing, ...mergedDefaults]);
    setInitialized(true);
  }, [currentClient, initialized, metrics]);

  // Auto-save advisor notes (debounced)
  useEffect(() => {
    if (!currentClient || !initialized) return;

    const timer = setTimeout(() => {
      if (advisorNotes !== currentClient.advisorNotes) {
        updateClient({ advisorNotes });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [advisorNotes, currentClient, initialized, updateClient]);

  // Persist action items
  const persistActionItems = useCallback(
    (items: ActionItem[]) => {
      setActionItems(items);
      updateClient({ actionItems: items });
    },
    [updateClient],
  );

  // Action item handlers
  const handleToggle = useCallback(
    (itemId: string) => {
      const updated = actionItems.map((a) =>
        a.id === itemId ? { ...a, completed: !a.completed } : a,
      );
      persistActionItems(updated);
    },
    [actionItems, persistActionItems],
  );

  const handleUpdateText = useCallback(
    (itemId: string, text: string) => {
      const updated = actionItems.map((a) =>
        a.id === itemId ? { ...a, text } : a,
      );
      persistActionItems(updated);
    },
    [actionItems, persistActionItems],
  );

  const handleDelete = useCallback(
    (itemId: string) => {
      const updated = actionItems.filter((a) => a.id !== itemId);
      persistActionItems(updated);
    },
    [actionItems, persistActionItems],
  );

  const handleAddItem = useCallback(() => {
    if (!newItemText.trim()) return;
    const item: ActionItem = {
      id: uuidv4(),
      text: newItemText.trim(),
      completed: false,
      category: newItemCategory,
    };
    const updated = [...actionItems, item];
    persistActionItems(updated);
    setNewItemText('');
  }, [newItemText, newItemCategory, actionItems, persistActionItems]);

  const handleAddKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddItem();
    }
  };

  // Export handlers
  const handlePrint = () => {
    window.print();
  };

  const handleCopyToClipboard = async () => {
    if (!currentClient) return;
    const text = generatePlainTextSummary(currentClient, findings, actionItems);
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: loading / no client states
  // ---------------------------------------------------------------------------

  if (!currentClient) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-text-secondary">
          No client loaded. Please select a client to view the summary.
        </p>
      </div>
    );
  }

  const client = currentClient;
  const completedCount = actionItems.filter((a) => a.completed).length;
  const totalCount = actionItems.length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      {/* Page header — print only */}
      <div className="print-only mb-6">
        <h1 className="font-serif text-2xl text-navy tracking-wide">
          Financial Plan Summary
        </h1>
        <p className="text-sm text-text-secondary">
          {client.firstName} {client.lastName} &mdash;{' '}
          {new Date().toLocaleDateString('en-CA')}
        </p>
      </div>

      {/* Page header — screen only */}
      <div className="no-print">
        <h1 className="font-serif text-2xl text-navy tracking-wide">
          Recommendations &amp; Summary
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Action plan for {client.firstName} {client.lastName}
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. PRIORITY RECAP                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="rounded-lg border border-card-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-lg text-navy tracking-wide">
            Priority Recap
          </h2>

          {client.priorityRanking.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {client.priorityRanking.map((priority, index) => (
                <span
                  key={priority}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  {priority}
                </span>
              ))}
            </div>
          ) : client.priorities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {client.priorities.map((p) => (
                <span
                  key={p.category}
                  className="inline-flex items-center rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent"
                >
                  {p.category}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-text-secondary">
              No priorities selected yet. Complete the Discovery module to set
              priorities.
            </p>
          )}

          {/* Show selected items within each priority */}
          {client.priorities.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {client.priorities
                .filter((p) => p.items.length > 0)
                .map((p) => (
                  <div
                    key={p.category}
                    className="rounded-md bg-bg-secondary px-3 py-2"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {p.category}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.items.map((item) => (
                        <span
                          key={item}
                          className="rounded border border-card-border bg-white px-2 py-0.5 text-xs text-text-primary"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. KEY METRICS                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="rounded-lg border border-card-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-lg text-navy tracking-wide">
            Key Metrics
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Income Replacement Ratio */}
            <div className="rounded-lg bg-bg-secondary px-4 py-3">
              <p className="text-xs font-medium text-text-secondary">Income Replacement Ratio</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${
                metrics.incomeReplacementRatio >= 0.7 ? 'text-positive' : metrics.incomeReplacementRatio >= 0.5 ? 'text-warning' : 'text-negative'
              }`}>
                {((metrics.incomeReplacementRatio) * 100).toFixed(1)}%
              </p>
              <p className="mt-0.5 text-[10px] text-text-secondary">
                {metrics.incomeReplacementRatio >= 0.7 ? 'On track' : 'Needs attention'}
              </p>
            </div>

            {/* Money Lasts Until Age */}
            <div className="rounded-lg bg-bg-secondary px-4 py-3">
              <p className="text-xs font-medium text-text-secondary">Money Lasts Until Age</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${
                metrics.moneyLastsUntilAge === null ? 'text-positive' : metrics.moneyLastsUntilAge >= 90 ? 'text-positive' : metrics.moneyLastsUntilAge >= 80 ? 'text-warning' : 'text-negative'
              }`}>
                {metrics.moneyLastsUntilAge === null ? '95+' : `${metrics.moneyLastsUntilAge}`}
              </p>
              <p className="mt-0.5 text-[10px] text-text-secondary">
                {metrics.moneyLastsUntilAge === null ? 'Surplus at 95' : `Depleted at ${metrics.moneyLastsUntilAge}`}
              </p>
            </div>

            {/* Total Lifetime Tax */}
            <div className="rounded-lg bg-bg-secondary px-4 py-3">
              <p className="text-xs font-medium text-text-secondary">Total Lifetime Tax</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">
                {formatCurrency(metrics.totalLifetimeTax)}
              </p>
              <p className="mt-0.5 text-[10px] text-text-secondary">Fed + provincial</p>
            </div>

            {/* Avg Effective Tax Rate */}
            <div className="rounded-lg bg-bg-secondary px-4 py-3">
              <p className="text-xs font-medium text-text-secondary">Avg Effective Tax Rate</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${
                (metrics.avgEffectiveTaxRate ?? 0) > 0.30 ? 'text-negative' : 'text-text-primary'
              }`}>
                {((metrics.avgEffectiveTaxRate ?? 0) * 100).toFixed(1)}%
              </p>
              <p className="mt-0.5 text-[10px] text-text-secondary">In retirement</p>
            </div>

            {/* OAS Clawback Total */}
            <div className="rounded-lg bg-bg-secondary px-4 py-3">
              <p className="text-xs font-medium text-text-secondary">OAS Clawback Total</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${
                (metrics.totalOasClawback ?? 0) > 0 ? 'text-negative' : 'text-positive'
              }`}>
                {(metrics.totalOasClawback ?? 0) > 0 ? formatCurrency(metrics.totalOasClawback ?? 0) : 'None'}
              </p>
              <p className="mt-0.5 text-[10px] text-text-secondary">
                {(metrics.oasClawbackYears ?? 0) > 0 ? `${metrics.oasClawbackYears} years` : 'No clawback'}
              </p>
            </div>

            {/* Surplus at 95 */}
            <div className="rounded-lg bg-bg-secondary px-4 py-3">
              <p className="text-xs font-medium text-text-secondary">Surplus at 95</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${
                metrics.surplusAtAge95 !== null && metrics.surplusAtAge95 > 0 ? 'text-positive' : metrics.surplusAtAge95 !== null ? 'text-negative' : 'text-text-secondary'
              }`}>
                {metrics.surplusAtAge95 !== null ? formatCurrency(metrics.surplusAtAge95) : 'N/A'}
              </p>
              <p className="mt-0.5 text-[10px] text-text-secondary">
                {metrics.surplusAtAge95 !== null && metrics.surplusAtAge95 > 0 ? 'Strong position' : metrics.surplusAtAge95 !== null ? 'Shortfall' : '--'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. KEY FINDINGS                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="rounded-lg border border-card-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-lg text-navy tracking-wide">
            Key Findings
          </h2>

          {findings.length > 0 ? (
            <div className="space-y-3">
              {findings.map((finding, i) => (
                <FindingCard key={i} text={finding} />
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-text-secondary">
              Complete the client profile and projections to generate findings.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. ACTION ITEMS CHECKLIST                                           */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="rounded-lg border border-card-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg text-navy tracking-wide">Action Items</h2>
            {totalCount > 0 && (
              <span className="text-sm text-text-secondary">
                {completedCount} of {totalCount} complete
              </span>
            )}
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-positive transition-all duration-500"
                style={{
                  width: `${(completedCount / totalCount) * 100}%`,
                }}
              />
            </div>
          )}

          {/* Item list */}
          <div className="space-y-2">
            {actionItems.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onUpdate={handleUpdateText}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {actionItems.length === 0 && (
            <p className="mb-4 text-sm italic text-text-secondary">
              No action items yet. Add items below or complete the client
              profile to auto-generate recommendations.
            </p>
          )}

          {/* Add new action item */}
          <div className="no-print mt-4 flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Add a new action item..."
              className="min-w-0 flex-1 rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary/50 focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="Insurance">Insurance</option>
              <option value="Estate">Estate</option>
              <option value="Savings">Savings</option>
              <option value="Debt">Debt</option>
              <option value="Retirement">Retirement</option>
              <option value="Tax">Tax</option>
              <option value="Other">Other</option>
            </select>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!newItemText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. ADVISOR NOTES                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="rounded-lg border border-card-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg text-navy tracking-wide">Advisor Notes</h2>
            <span className="no-print text-xs text-text-secondary">
              Auto-saves as you type
            </span>
          </div>

          <textarea
            value={advisorNotes}
            onChange={(e) => setAdvisorNotes(e.target.value)}
            placeholder="Meeting notes, follow-up items, observations..."
            rows={8}
            className="no-print w-full resize-y rounded-lg border border-card-border bg-bg-secondary px-4 py-3 text-sm leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-secondary/50 focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent"
          />

          {/* Print-only: render notes as plain text */}
          {advisorNotes && (
            <div className="print-only mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
              {advisorNotes}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. EXPORT SECTION                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="no-print">
        <div className="rounded-lg border border-card-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-lg text-navy tracking-wide">Export</h2>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
            >
              <PrinterIcon className="h-4 w-4" />
              Print Summary
            </button>

            <button
              type="button"
              onClick={handleCopyToClipboard}
              className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                copySuccess
                  ? 'border-positive bg-positive/10 text-positive focus:ring-positive'
                  : 'border-card-border bg-white text-text-primary hover:bg-bg-secondary focus:ring-navy'
              }`}
            >
              <ClipboardIcon className="h-4 w-4" />
              {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
            </button>

            <button
              type="button"
              onClick={() => navigate(`/client/${id}/report`)}
              className="inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Full Plan Report
            </button>
          </div>

          <p className="mt-3 text-xs text-text-secondary">
            Print creates a clean, print-friendly version. Copy to Clipboard
            generates a plain-text summary. Full Plan Report opens a
            comprehensive, printable financial plan document with narrative
            sections.
          </p>
        </div>
      </section>

      {/* Bottom spacer for scroll comfort */}
      <div className="h-8" />
    </div>
  );
}
