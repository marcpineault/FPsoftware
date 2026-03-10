import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { generateProjections, calculateKeyMetrics } from '../../lib/calculations';
import type { ProjectionParams, ProjectionRow } from '../../lib/types';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number): string {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return (
      (n < 0 ? '-' : '') +
      '$' +
      (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1) +
      'M'
    );
  }
  return n.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatCurrencyFull(n: number): string {
  return n.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

/* ------------------------------------------------------------------ */
/*  Slider Component                                                   */
/* ------------------------------------------------------------------ */

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  onChange: (v: number) => void;
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
}: ParamSliderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-text-primary">{label}</label>
        <span className="text-sm font-semibold text-navy tabular-nums min-w-[3.5rem] text-right">
          {formatValue(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-card-border rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-accent
          [&::-webkit-slider-thumb]:shadow-sm
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-accent
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:shadow-sm
          [&::-moz-range-thumb]:cursor-pointer
          focus:outline-none focus:ring-0"
      />
      <div className="flex justify-between text-[10px] text-text-secondary tabular-nums">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chevron Icon                                                       */
/* ------------------------------------------------------------------ */

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart Tooltip                                                      */
/* ------------------------------------------------------------------ */

interface ChartPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-card-border rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold text-text-primary mb-2">Age {label}</p>
      <div className="space-y-1">
        {payload.map((item: ChartPayloadItem) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-text-secondary">{item.name}</span>
            </div>
            <span className="font-medium tabular-nums text-text-primary">
              {formatCurrencyFull(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Table columns                                                      */
/* ------------------------------------------------------------------ */

interface TableColumn {
  key: keyof ProjectionRow;
  label: string;
  shortLabel?: string;
  format: 'currency' | 'number' | 'year' | 'percent';
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'year', label: 'Year', format: 'year' },
  { key: 'age', label: 'Age', format: 'number' },
  { key: 'employmentIncome', label: 'Employment Income', shortLabel: 'Employment', format: 'currency' },
  { key: 'cpp', label: 'CPP', format: 'currency' },
  { key: 'oas', label: 'OAS', format: 'currency' },
  { key: 'pensionIncome', label: 'Pension', format: 'currency' },
  { key: 'rrspRrifWithdrawals', label: 'RRSP/RRIF', shortLabel: 'RRSP/RRIF', format: 'currency' },
  { key: 'tfsaWithdrawals', label: 'TFSA W/D', shortLabel: 'TFSA W/D', format: 'currency' },
  { key: 'nonRegWithdrawals', label: 'Non-Reg W/D', shortLabel: 'Non-Reg', format: 'currency' },
  { key: 'totalIncome', label: 'Total Income', shortLabel: 'Total Inc.', format: 'currency' },
  { key: 'incomeTax', label: 'Income Tax', shortLabel: 'Tax', format: 'currency' },
  { key: 'marginalTaxRate', label: 'Marginal Rate', shortLabel: 'Marg.%', format: 'percent' },
  { key: 'afterTaxIncome', label: 'After-Tax Income', shortLabel: 'After-Tax', format: 'currency' },
  { key: 'expenses', label: 'Expenses', format: 'currency' },
  { key: 'netCashFlow', label: 'Net Cash Flow', shortLabel: 'Net CF', format: 'currency' },
  { key: 'rrspRrifBalance', label: 'RRSP/RRIF Bal.', shortLabel: 'RRSP Bal.', format: 'currency' },
  { key: 'tfsaBalance', label: 'TFSA Bal.', format: 'currency' },
  { key: 'nonRegBalance', label: 'Non-Reg Bal.', shortLabel: 'Non-Reg Bal.', format: 'currency' },
  { key: 'netWorth', label: 'Net Worth', format: 'currency' },
];

/* ------------------------------------------------------------------ */
/*  Chart colors                                                       */
/* ------------------------------------------------------------------ */

const CHART_COLORS = {
  employment: '#1B2A4A',    // navy
  cpp: '#2D5016',           // accent green
  oas: '#0E7490',           // teal
  pension: '#7C3AED',       // violet
  rrsp: '#DC7C14',          // amber
  tfsa: '#2563EB',          // blue
  nonReg: '#059669',        // emerald
  expenses: '#DC2626',      // red
};

/* ------------------------------------------------------------------ */
/*  Main Projections Component                                         */
/* ------------------------------------------------------------------ */

export function Projections() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentClient, updateClient } = useAppStore();

  const [view, setView] = useState<'table' | 'chart' | 'balances' | 'income'>('table');
  const [paramsExpanded, setParamsExpanded] = useState(true);

  // Local params state for instant reactivity
  const [localParams, setLocalParams] = useState<ProjectionParams>(
    currentClient?.projectionParams ?? {
      retirementAge: 65,
      cppStartAge: 65,
      oasStartAge: 65,
      estimatedCppMonthly: 1000,
      inflationRate: 0.02,
      rrspReturnRate: 0.045,
      tfsaReturnRate: 0.05,
      nonRegReturnRate: 0.04,
      retirementSpendingRate: 0.80,
      enablePensionSplitting: true,
      earlyRrifConversion: false,
    },
  );

  // Local contribution overrides for what-if modeling
  const [localContributions, setLocalContributions] = useState({
    rrspAnnualContribution: currentClient?.rrspAnnualContribution ?? 0,
    tfsaAnnualContribution: currentClient?.tfsaAnnualContribution ?? 0,
    monthlyExpenses: currentClient?.monthlyExpenses ?? 5000,
  });

  // Sync local params when client changes
  useEffect(() => {
    if (currentClient?.projectionParams) {
      setLocalParams(currentClient.projectionParams);
    }
    if (currentClient) {
      setLocalContributions({
        rrspAnnualContribution: currentClient.rrspAnnualContribution,
        tfsaAnnualContribution: currentClient.tfsaAnnualContribution,
        monthlyExpenses: currentClient.monthlyExpenses,
      });
    }
  }, [currentClient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save params with debounce
  useEffect(() => {
    if (!currentClient) return;

    const timer = setTimeout(() => {
      updateClient({
        projectionParams: localParams,
        ...localContributions,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [localParams, localContributions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate projections
  const projections: ProjectionRow[] = useMemo(() => {
    if (!currentClient) return [];
    // Use a client copy with current local params for instant recalculation
    const clientWithParams = {
      ...currentClient,
      ...localContributions,
      projectionParams: localParams,
    };
    return generateProjections(clientWithParams);
  }, [currentClient, localParams, localContributions]);

  // Calculate key metrics
  const metrics = useMemo(
    () => calculateKeyMetrics(projections, localParams),
    [projections, localParams],
  );

  // Chart data
  const chartData = useMemo(
    () =>
      projections.map((row) => ({
        age: row.age,
        'Employment Income': row.employmentIncome,
        CPP: row.cpp,
        OAS: row.oas,
        Pension: row.pensionIncome,
        'RRSP/RRIF': row.rrspRrifWithdrawals,
        TFSA: row.tfsaWithdrawals,
        'Non-Reg': row.nonRegWithdrawals,
        Expenses: row.expenses,
      })),
    [projections],
  );

  // Balance chart data
  const balanceChartData = useMemo(
    () =>
      projections.map((row) => ({
        age: row.age,
        'RRSP/RRIF': row.rrspRrifBalance,
        'TFSA': row.tfsaBalance,
        'Non-Reg': row.nonRegBalance ?? 0,
        'Net Worth': row.netWorth,
      })),
    [projections],
  );

  // Income sources chart data (retirement years only)
  const incomeChartData = useMemo(
    () =>
      projections
        .filter((r) => r.isRetired)
        .map((row) => ({
          age: row.age,
          'CPP': row.cpp,
          'OAS': row.oas,
          'GIS': row.gis ?? 0,
          'Pension': row.pensionIncome,
          'RRSP/RRIF': row.rrspRrifWithdrawals,
          'TFSA': row.tfsaWithdrawals,
          'Non-Reg': row.nonRegWithdrawals,
          'Spouse CPP/OAS': (row.spouseCpp ?? 0) + (row.spouseOas ?? 0),
          'Tax': -row.incomeTax,
          'After-Tax': row.afterTaxIncome,
          'Expenses': row.expenses,
        })),
    [projections],
  );

  // Find retirement transition year index
  const retirementRowIndex = useMemo(
    () => projections.findIndex((r) => r.isRetired),
    [projections],
  );

  // Parameter update handler
  const handleParamChange = useCallback(
    (key: keyof ProjectionParams, value: number | boolean) => {
      setLocalParams((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Navigation
  const handleBack = useCallback(() => {
    navigate(`/client/${id}/profile`);
  }, [navigate, id]);

  const handleNext = useCallback(() => {
    updateClient({ projectionsViewed: true });
    navigate(`/client/${id}/summary`);
  }, [navigate, id, updateClient]);

  // Mark as viewed on mount
  useEffect(() => {
    if (currentClient && !currentClient.projectionsViewed) {
      updateClient({ projectionsViewed: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* -------------------------------------------------------------- */
  /*  No client guard                                                */
  /* -------------------------------------------------------------- */

  if (!currentClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-text-secondary text-sm">No client loaded.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-3 text-sm text-accent hover:text-accent-hover underline"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------- */
  /*  Metric card color helpers                                      */
  /* -------------------------------------------------------------- */

  const replacementColor: 'positive' | 'warning' | 'negative' =
    metrics.incomeReplacementRatio >= 0.7
      ? 'positive'
      : metrics.incomeReplacementRatio >= 0.5
        ? 'warning'
        : 'negative';

  const moneyLastsLabel =
    metrics.moneyLastsUntilAge === null ? '95+' : `Age ${metrics.moneyLastsUntilAge}`;
  const moneyLastsColor: 'positive' | 'warning' | 'negative' =
    metrics.moneyLastsUntilAge === null
      ? 'positive'
      : metrics.moneyLastsUntilAge >= 90
        ? 'positive'
        : metrics.moneyLastsUntilAge >= 80
          ? 'warning'
          : 'negative';

  /* -------------------------------------------------------------- */
  /*  Render                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-2xl text-text-primary tracking-wide">
          Financial Projections
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Year-by-year projection for{' '}
          <span className="font-medium text-text-primary">
            {currentClient.firstName} {currentClient.lastName}
          </span>
          . Adjust parameters to explore different scenarios.
        </p>
      </div>

      {/* -------------------------------------------------------- */}
      {/*  KEY METRICS CARDS                                        */}
      {/* -------------------------------------------------------- */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {/* Income Replacement Ratio */}
        <div className="metric-card bg-card-bg rounded-xl border border-card-border shadow-sm p-5">
          <p className="text-sm font-medium text-text-secondary">
            Income Replacement Ratio
          </p>
          <p
            className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${
              replacementColor === 'positive'
                ? 'text-positive'
                : replacementColor === 'warning'
                  ? 'text-warning'
                  : 'text-negative'
            }`}
          >
            {formatPercent(metrics.incomeReplacementRatio)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {replacementColor === 'positive'
              ? 'On track'
              : replacementColor === 'warning'
                ? 'May need adjustment'
                : 'Below target'}
          </p>
        </div>

        {/* Money Lasts Until Age */}
        <div className="metric-card bg-card-bg rounded-xl border border-card-border shadow-sm p-5">
          <p className="text-sm font-medium text-text-secondary">
            Money Lasts Until Age
          </p>
          <p
            className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${
              moneyLastsColor === 'positive'
                ? 'text-positive'
                : moneyLastsColor === 'warning'
                  ? 'text-warning'
                  : 'text-negative'
            }`}
          >
            {moneyLastsLabel}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {metrics.moneyLastsUntilAge === null
              ? 'Surplus at age 95'
              : `Funds depleted at age ${metrics.moneyLastsUntilAge}`}
          </p>
        </div>

        {/* Total Lifetime Tax */}
        <div className="metric-card bg-card-bg rounded-xl border border-card-border shadow-sm p-5">
          <p className="text-sm font-medium text-text-secondary">
            Total Lifetime Tax
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
            {formatCurrency(metrics.totalLifetimeTax)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Estimated federal + provincial
          </p>
        </div>

        {/* Avg Effective Tax Rate */}
        <div className="metric-card bg-card-bg rounded-xl border border-card-border shadow-sm p-5">
          <p className="text-sm font-medium text-text-secondary">
            Avg Effective Tax Rate (Retirement)
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
            {formatPercent(metrics.avgEffectiveTaxRate ?? 0)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Incl. OAS clawback
          </p>
        </div>

        {/* OAS Clawback */}
        <div className="metric-card bg-card-bg rounded-xl border border-card-border shadow-sm p-5">
          <p className="text-sm font-medium text-text-secondary">
            OAS Clawback
          </p>
          <p className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${
            (metrics.totalOasClawback ?? 0) > 0 ? 'text-negative' : 'text-positive'
          }`}>
            {(metrics.totalOasClawback ?? 0) > 0
              ? formatCurrency(metrics.totalOasClawback ?? 0)
              : 'None'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {(metrics.oasClawbackYears ?? 0) > 0
              ? `${metrics.oasClawbackYears} years affected`
              : 'No clawback projected'}
          </p>
        </div>

        {/* CPP + OAS % */}
        <div className="metric-card bg-card-bg rounded-xl border border-card-border shadow-sm p-5">
          <p className="text-sm font-medium text-text-secondary">
            CPP + OAS % of Retirement Income
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
            {formatPercent(metrics.cppOasPercentOfRetirementIncome)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Government benefit reliance
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------- */}
      {/*  ADJUSTABLE PARAMETERS                                    */}
      {/* -------------------------------------------------------- */}

      <div className="bg-white rounded-lg border border-card-border shadow-sm overflow-hidden">
        <button
          onClick={() => setParamsExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="text-text-secondary"
            >
              <path
                d="M7.5 3L7.5 15M10.5 3L10.5 15M3 7.5L15 7.5M3 10.5L15 10.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm font-semibold text-text-primary">
              Projection Parameters
            </span>
            <span className="text-xs text-text-secondary font-normal">
              -- Adjust assumptions to explore scenarios
            </span>
          </div>
          <ChevronIcon expanded={paramsExpanded} />
        </button>

        {paramsExpanded && (
          <div className="px-5 pb-5 border-t border-card-border pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-5">
              <ParamSlider
                label="Retirement Age"
                value={localParams.retirementAge}
                min={55}
                max={75}
                step={1}
                formatValue={(v) => `${v}`}
                onChange={(v) => handleParamChange('retirementAge', v)}
              />
              <ParamSlider
                label="CPP Start Age"
                value={localParams.cppStartAge}
                min={60}
                max={70}
                step={1}
                formatValue={(v) => `${v}`}
                onChange={(v) => handleParamChange('cppStartAge', v)}
              />
              <ParamSlider
                label="Est. CPP at 65 ($/mo)"
                value={localParams.estimatedCppMonthly}
                min={0}
                max={1400}
                step={25}
                formatValue={(v) => `$${v.toLocaleString()}`}
                onChange={(v) => handleParamChange('estimatedCppMonthly', v)}
              />
              <ParamSlider
                label="OAS Start Age"
                value={localParams.oasStartAge}
                min={65}
                max={70}
                step={1}
                formatValue={(v) => `${v}`}
                onChange={(v) => handleParamChange('oasStartAge', v)}
              />
              <ParamSlider
                label="Inflation Rate"
                value={localParams.inflationRate * 100}
                min={0}
                max={5}
                step={0.1}
                formatValue={(v) => `${v.toFixed(1)}%`}
                onChange={(v) => handleParamChange('inflationRate', v / 100)}
              />
              <ParamSlider
                label="RRSP Return Rate"
                value={localParams.rrspReturnRate * 100}
                min={0}
                max={10}
                step={0.1}
                formatValue={(v) => `${v.toFixed(1)}%`}
                onChange={(v) => handleParamChange('rrspReturnRate', v / 100)}
              />
              <ParamSlider
                label="TFSA Return Rate"
                value={localParams.tfsaReturnRate * 100}
                min={0}
                max={10}
                step={0.1}
                formatValue={(v) => `${v.toFixed(1)}%`}
                onChange={(v) => handleParamChange('tfsaReturnRate', v / 100)}
              />
              <ParamSlider
                label="Non-Reg Return Rate"
                value={localParams.nonRegReturnRate * 100}
                min={0}
                max={10}
                step={0.1}
                formatValue={(v) => `${v.toFixed(1)}%`}
                onChange={(v) => handleParamChange('nonRegReturnRate', v / 100)}
              />
              <ParamSlider
                label="Retirement Spending"
                value={localParams.retirementSpendingRate * 100}
                min={50}
                max={100}
                step={5}
                formatValue={(v) => `${v.toFixed(0)}%`}
                onChange={(v) => handleParamChange('retirementSpendingRate', v / 100)}
              />
            </div>
            {/* Strategy toggles */}
            <div className="mt-4 pt-4 border-t border-card-border/60 flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={localParams.enablePensionSplitting}
                  onChange={(e) => handleParamChange('enablePensionSplitting', e.target.checked)}
                  className="rounded border-card-border text-accent focus:ring-accent/20"
                />
                Pension Splitting
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={localParams.earlyRrifConversion ?? false}
                  onChange={(e) => handleParamChange('earlyRrifConversion', e.target.checked)}
                  className="rounded border-card-border text-accent focus:ring-accent/20"
                />
                Early RRIF at 65
                <span className="text-xs text-text-tertiary">(enables splitting)</span>
              </label>
            </div>

            <div className="mt-4 pt-4 border-t border-card-border/60">
              <p className="text-xs text-text-tertiary tracking-wider uppercase mb-3">Contributions & Expenses</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                <ParamSlider
                  label="RRSP Annual Contribution"
                  value={localContributions.rrspAnnualContribution}
                  min={0}
                  max={32000}
                  step={500}
                  formatValue={(v) => `$${v.toLocaleString()}`}
                  onChange={(v) => setLocalContributions(prev => ({ ...prev, rrspAnnualContribution: v }))}
                />
                <ParamSlider
                  label="TFSA Annual Contribution"
                  value={localContributions.tfsaAnnualContribution}
                  min={0}
                  max={7000}
                  step={250}
                  formatValue={(v) => `$${v.toLocaleString()}`}
                  onChange={(v) => setLocalContributions(prev => ({ ...prev, tfsaAnnualContribution: v }))}
                />
                <ParamSlider
                  label="Monthly Expenses"
                  value={localContributions.monthlyExpenses}
                  min={2000}
                  max={20000}
                  step={250}
                  formatValue={(v) => `$${v.toLocaleString()}`}
                  onChange={(v) => setLocalContributions(prev => ({ ...prev, monthlyExpenses: v }))}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- */}
      {/*  VIEW TOGGLE                                              */}
      {/* -------------------------------------------------------- */}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center bg-white border border-card-border rounded-lg p-0.5">
          <button
            onClick={() => setView('table')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'table'
                ? 'bg-navy text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.2" />
                <line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.2" />
                <line x1="5" y1="1" x2="5" y2="13" stroke="currentColor" strokeWidth="1.2" />
                <line x1="9" y1="1" x2="9" y2="13" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              Table
            </span>
          </button>
          <button
            onClick={() => setView('chart')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'chart'
                ? 'bg-navy text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <polyline points="1,12 4,7 7,9 10,3 13,5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              Chart
            </span>
          </button>
          <button
            onClick={() => setView('balances')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'balances'
                ? 'bg-navy text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 12L4.5 5L8 8L13 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 2H13V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Balances
            </span>
          </button>
          <button
            onClick={() => setView('income')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'income'
                ? 'bg-navy text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="8" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.4" />
                <rect x="5.5" y="5" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.6" />
                <rect x="10" y="2" width="3" height="11" rx="0.5" fill="currentColor" opacity="0.8" />
              </svg>
              Income
            </span>
          </button>
        </div>

        <p className="text-xs text-text-secondary">
          Showing ages {projections[0]?.age ?? '--'} to{' '}
          {projections[projections.length - 1]?.age ?? '--'} ({projections.length} years)
        </p>
      </div>

      {/* -------------------------------------------------------- */}
      {/*  TABLE VIEW                                               */}
      {/* -------------------------------------------------------- */}

      {view === 'table' && (
        <div className="bg-white rounded-lg border border-card-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header-refined text-white">
                  {TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="sticky top-0 z-10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap table-header-refined"
                    >
                      <span className="hidden xl:inline">{col.label}</span>
                      <span className="xl:hidden">{col.shortLabel ?? col.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projections.map((row, idx) => {
                  const isRetirementYear = idx === retirementRowIndex;
                  const isEven = idx % 2 === 0;

                  let rowBg: string;
                  if (isRetirementYear) {
                    rowBg = 'bg-amber-50';
                  } else if (isEven) {
                    rowBg = 'bg-white';
                  } else {
                    rowBg = 'bg-bg-secondary/50';
                  }

                  return (
                    <tr
                      key={row.year}
                      className={`${rowBg} hover:bg-blue-50/50 transition-colors border-b border-card-border/50 last:border-b-0`}
                    >
                      {TABLE_COLUMNS.map((col) => {
                        const val = row[col.key] as number;
                        const isCashFlow = col.key === 'netCashFlow';
                        const isNegative = isCashFlow && val < 0;

                        let cellText: string;
                        if (col.format === 'currency') {
                          cellText = val === 0 ? '--' : formatCurrencyFull(val);
                        } else if (col.format === 'percent') {
                          cellText = val != null ? `${(val * 100).toFixed(1)}%` : '--';
                        } else if (col.format === 'year') {
                          cellText = String(val);
                        } else {
                          cellText = String(val);
                        }

                        return (
                          <td
                            key={col.key}
                            className={`px-3 py-2.5 tabular-nums whitespace-nowrap text-sm ${
                              isNegative ? 'text-negative font-medium' : 'text-text-primary'
                            } ${
                              col.key === 'totalIncome' || col.key === 'netCashFlow' || col.key === 'netWorth'
                                ? 'font-medium'
                                : ''
                            }`}
                          >
                            {cellText}
                            {isRetirementYear && col.key === 'age' && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-800">
                                RETIRE
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {projections.length === 0 && (
            <div className="flex items-center justify-center py-16 text-text-secondary text-sm">
              No projection data available. Please complete the client profile first.
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/*  CHART VIEW                                               */}
      {/* -------------------------------------------------------- */}

      {view === 'chart' && (
        <div className="bg-white rounded-lg border border-card-border shadow-sm p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            Income Sources vs. Expenses Over Time
          </h3>
          <p className="text-xs text-text-secondary mb-6">
            Stacked income sources with expense overlay. Hover for details.
          </p>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  label={{
                    value: 'Age',
                    position: 'insideBottomRight',
                    offset: -5,
                    style: { fontSize: 11, fill: '#6B7280' },
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="rect"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11 }}
                />

                {/* Stacked areas: income sources */}
                <Area
                  type="monotone"
                  dataKey="Employment Income"
                  stackId="income"
                  fill={CHART_COLORS.employment}
                  stroke={CHART_COLORS.employment}
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="CPP"
                  stackId="income"
                  fill={CHART_COLORS.cpp}
                  stroke={CHART_COLORS.cpp}
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="OAS"
                  stackId="income"
                  fill={CHART_COLORS.oas}
                  stroke={CHART_COLORS.oas}
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="Pension"
                  stackId="income"
                  fill={CHART_COLORS.pension}
                  stroke={CHART_COLORS.pension}
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="RRSP/RRIF"
                  stackId="income"
                  fill={CHART_COLORS.rrsp}
                  stroke={CHART_COLORS.rrsp}
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="TFSA"
                  stackId="income"
                  fill={CHART_COLORS.tfsa}
                  stroke={CHART_COLORS.tfsa}
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="Non-Reg"
                  stackId="income"
                  fill={CHART_COLORS.nonReg}
                  stroke={CHART_COLORS.nonReg}
                  fillOpacity={0.7}
                />

                {/* Expense line overlay */}
                <Line
                  type="monotone"
                  dataKey="Expenses"
                  stroke={CHART_COLORS.expenses}
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 4, fill: CHART_COLORS.expenses }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-24 text-text-secondary text-sm">
              No projection data available. Please complete the client profile first.
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/*  BALANCES CHART VIEW                                      */}
      {/* -------------------------------------------------------- */}

      {view === 'balances' && (
        <div className="bg-white rounded-lg border border-card-border shadow-sm p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            Investment Balances &amp; Net Worth Over Time
          </h3>
          <p className="text-xs text-text-secondary mb-6">
            Stacked account balances with net worth overlay. Hover for details.
          </p>

          {balanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart
                data={balanceChartData}
                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  label={{
                    value: 'Age',
                    position: 'insideBottomRight',
                    offset: -5,
                    style: { fontSize: 11, fill: '#6B7280' },
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => {
                    const abs = Math.abs(v);
                    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                    if (abs >= 1000) return `$${(v / 1000).toFixed(0)}K`;
                    return `$${v}`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="rect"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11 }}
                />

                {/* Stacked areas: account balances */}
                <Area
                  type="monotone"
                  dataKey="RRSP/RRIF"
                  stackId="balances"
                  fill="#7C3AED"
                  stroke="#7C3AED"
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="TFSA"
                  stackId="balances"
                  fill="#2563EB"
                  stroke="#2563EB"
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="Non-Reg"
                  stackId="balances"
                  fill="#059669"
                  stroke="#059669"
                  fillOpacity={0.7}
                />

                {/* Net Worth line overlay */}
                <Line
                  type="monotone"
                  dataKey="Net Worth"
                  stroke="#1B2A4A"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4, fill: '#1B2A4A' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-24 text-text-secondary text-sm">
              No projection data available. Please complete the client profile first.
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/*  INCOME SOURCES CHART VIEW                                */}
      {/* -------------------------------------------------------- */}

      {view === 'income' && (
        <div className="bg-white rounded-lg border border-card-border shadow-sm p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            Retirement Income Sources by Age
          </h3>
          <p className="text-xs text-text-secondary mb-6">
            Stacked income sources with after-tax income and expense overlay. Shows retirement years only.
          </p>

          {incomeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart
                data={incomeChartData}
                margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  label={{
                    value: 'Age',
                    position: 'insideBottomRight',
                    offset: -5,
                    style: { fontSize: 11, fill: '#6B7280' },
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => {
                    const abs = Math.abs(v);
                    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                    if (abs >= 1000) return `$${(v / 1000).toFixed(0)}K`;
                    return `$${v}`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="rect"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11 }}
                />

                {/* Stacked income sources */}
                <Area type="monotone" dataKey="CPP" stackId="income" fill="#2563EB" stroke="#2563EB" fillOpacity={0.8} />
                <Area type="monotone" dataKey="OAS" stackId="income" fill="#7C3AED" stroke="#7C3AED" fillOpacity={0.7} />
                <Area type="monotone" dataKey="GIS" stackId="income" fill="#8B5CF6" stroke="#8B5CF6" fillOpacity={0.5} />
                <Area type="monotone" dataKey="Pension" stackId="income" fill="#059669" stroke="#059669" fillOpacity={0.7} />
                <Area type="monotone" dataKey="RRSP/RRIF" stackId="income" fill="#D97706" stroke="#D97706" fillOpacity={0.7} />
                <Area type="monotone" dataKey="TFSA" stackId="income" fill="#0891B2" stroke="#0891B2" fillOpacity={0.7} />
                <Area type="monotone" dataKey="Non-Reg" stackId="income" fill="#65A30D" stroke="#65A30D" fillOpacity={0.7} />
                <Area type="monotone" dataKey="Spouse CPP/OAS" stackId="income" fill="#EC4899" stroke="#EC4899" fillOpacity={0.6} />

                {/* Expenses line */}
                <Line
                  type="monotone"
                  dataKey="Expenses"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 3, fill: '#EF4444' }}
                />

                {/* After-tax income line */}
                <Line
                  type="monotone"
                  dataKey="After-Tax"
                  stroke="#1B2A4A"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#1B2A4A' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-24 text-text-secondary text-sm">
              No retirement projection data available. Complete profile and set a retirement age.
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/*  NAVIGATION                                               */}
      {/* -------------------------------------------------------- */}

      <div className="flex items-center justify-between pt-2 pb-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-card-border bg-white text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M8.5 3L4.5 7L8.5 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back: Profile
        </button>

        <button
          onClick={handleNext}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
        >
          Next: Summary
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M5.5 3L9.5 7L5.5 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
