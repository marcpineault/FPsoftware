import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { generateProjections, calculateKeyMetrics } from '../../lib/calculations';
import type { ProjectionParams, KeyMetrics } from '../../lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
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

function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScenarioConfig {
  name: string;
  params: ProjectionParams;
}

interface ScenarioResult {
  name: string;
  params: ProjectionParams;
  metrics: KeyMetrics;
}

/* ------------------------------------------------------------------ */
/*  Preset definitions                                                 */
/* ------------------------------------------------------------------ */

interface Preset {
  label: string;
  description: string;
  scenarios: { name: string; overrides: Partial<ProjectionParams> }[];
}

const PRESETS: Preset[] = [
  {
    label: 'Retire at 60 vs 65 vs 67',
    description: 'Compare early, standard, and delayed retirement',
    scenarios: [
      { name: 'Retire at 60', overrides: { retirementAge: 60 } },
      { name: 'Retire at 65', overrides: { retirementAge: 65 } },
      { name: 'Retire at 67', overrides: { retirementAge: 67 } },
    ],
  },
  {
    label: 'CPP at 60 vs 65 vs 70',
    description: 'Compare early, standard, and deferred CPP benefits',
    scenarios: [
      { name: 'CPP at 60', overrides: { cppStartAge: 60 } },
      { name: 'CPP at 65', overrides: { cppStartAge: 65 } },
      { name: 'CPP at 70', overrides: { cppStartAge: 70 } },
    ],
  },
  {
    label: 'Conservative vs Moderate vs Aggressive',
    description: 'Compare different investment return assumptions',
    scenarios: [
      {
        name: 'Conservative',
        overrides: { rrspReturnRate: 0.03, tfsaReturnRate: 0.035, nonRegReturnRate: 0.025 },
      },
      {
        name: 'Moderate',
        overrides: { rrspReturnRate: 0.045, tfsaReturnRate: 0.05, nonRegReturnRate: 0.04 },
      },
      {
        name: 'Aggressive',
        overrides: { rrspReturnRate: 0.07, tfsaReturnRate: 0.075, nonRegReturnRate: 0.06 },
      },
    ],
  },
  {
    label: 'OAS at 65 vs 67 vs 70',
    description: 'Impact of deferring OAS for higher payments',
    scenarios: [
      { name: 'OAS at 65', overrides: { oasStartAge: 65 } },
      { name: 'OAS at 67', overrides: { oasStartAge: 67 } },
      { name: 'OAS at 70', overrides: { oasStartAge: 70 } },
    ],
  },
  {
    label: 'Spending: 70% vs 80% vs 90%',
    description: 'Impact of retirement spending level on sustainability',
    scenarios: [
      { name: 'Frugal (70%)', overrides: { retirementSpendingRate: 0.70 } },
      { name: 'Moderate (80%)', overrides: { retirementSpendingRate: 0.80 } },
      { name: 'Comfortable (90%)', overrides: { retirementSpendingRate: 0.90 } },
    ],
  },
  {
    label: 'High Inflation Stress Test',
    description: 'How does higher inflation impact the plan?',
    scenarios: [
      { name: 'Low (1.5%)', overrides: { inflationRate: 0.015 } },
      { name: 'Normal (2.5%)', overrides: { inflationRate: 0.025 } },
      { name: 'High (4%)', overrides: { inflationRate: 0.04 } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Scenario Colors                                                    */
/* ------------------------------------------------------------------ */

const SCENARIO_COLORS = ['#1B2A4A', '#2D5016', '#0E7490'];

/* ------------------------------------------------------------------ */
/*  Card component                                                     */
/* ------------------------------------------------------------------ */

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
    <div className={`rounded-xl border border-card-border bg-white p-6 shadow-sm ${className}`}>
      {title && <h3 className="font-serif text-lg text-navy tracking-wide mb-4">{title}</h3>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Param Editor                                                       */
/* ------------------------------------------------------------------ */

interface ParamEditorProps {
  scenario: ScenarioConfig;
  index: number;
  onChange: (index: number, updates: Partial<ScenarioConfig>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  color: string;
}

function ParamEditor({ scenario, index, onChange, onRemove, canRemove, color }: ParamEditorProps) {
  const inputClass =
    'w-full rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm text-text-primary focus:border-navy focus:ring-2 focus:ring-navy/20 focus:outline-none transition-colors';

  const handleParamChange = (key: keyof ProjectionParams, value: number) => {
    onChange(index, {
      params: { ...scenario.params, [key]: value },
    });
  };

  return (
    <div className="rounded-lg border border-card-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <input
            type="text"
            value={scenario.name}
            onChange={(e) => onChange(index, { name: e.target.value })}
            className="text-sm font-semibold text-navy bg-transparent border-none focus:outline-none focus:ring-0 w-full"
            placeholder={`Scenario ${index + 1}`}
          />
        </div>
        {canRemove && (
          <button
            onClick={() => onRemove(index)}
            className="text-text-secondary hover:text-negative transition-colors p-1"
            title="Remove scenario"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Retirement Age</label>
          <input
            type="number"
            min={55}
            max={75}
            value={scenario.params.retirementAge}
            onChange={(e) => handleParamChange('retirementAge', parseInt(e.target.value, 10) || 65)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">CPP Start Age</label>
          <input
            type="number"
            min={60}
            max={70}
            value={scenario.params.cppStartAge}
            onChange={(e) => handleParamChange('cppStartAge', parseInt(e.target.value, 10) || 65)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">OAS Start Age</label>
          <input
            type="number"
            min={65}
            max={70}
            value={scenario.params.oasStartAge}
            onChange={(e) => handleParamChange('oasStartAge', parseInt(e.target.value, 10) || 65)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Spending Rate</label>
          <input
            type="number"
            min={50}
            max={100}
            step={5}
            value={Math.round(scenario.params.retirementSpendingRate * 100)}
            onChange={(e) =>
              handleParamChange('retirementSpendingRate', (parseInt(e.target.value, 10) || 80) / 100)
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">RRSP Return %</label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={(scenario.params.rrspReturnRate * 100).toFixed(1)}
            onChange={(e) =>
              handleParamChange('rrspReturnRate', (parseFloat(e.target.value) || 4.5) / 100)
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">TFSA Return %</label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={(scenario.params.tfsaReturnRate * 100).toFixed(1)}
            onChange={(e) =>
              handleParamChange('tfsaReturnRate', (parseFloat(e.target.value) || 5.0) / 100)
            }
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison Metric Row                                              */
/* ------------------------------------------------------------------ */

function MetricRow({
  label,
  values,
  format = 'text',
  highlight = false,
}: {
  label: string;
  values: (string | number | null)[];
  format?: 'currency' | 'percent' | 'age' | 'text';
  highlight?: boolean;
}) {
  const formatValue = (v: string | number | null): string => {
    if (v === null) return '95+';
    if (typeof v === 'string') return v;
    switch (format) {
      case 'currency':
        return formatCurrency(v);
      case 'percent':
        return formatPercent(v);
      case 'age':
        return `Age ${v}`;
      default:
        return String(v);
    }
  };

  return (
    <tr className={highlight ? 'bg-bg-secondary/50' : ''}>
      <td className="px-4 py-3 text-sm font-medium text-text-primary whitespace-nowrap">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className="px-4 py-3 text-sm tabular-nums text-text-primary text-center"
        >
          {formatValue(v)}
        </td>
      ))}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function ScenarioComparison() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentClient } = useAppStore();

  const defaultParams: ProjectionParams = currentClient?.projectionParams ?? {
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
  };

  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([
    { name: 'Base Case', params: { ...defaultParams } },
    { name: 'Scenario 2', params: { ...defaultParams } },
  ]);

  // Compute results for each scenario
  const results: ScenarioResult[] = useMemo(() => {
    if (!currentClient) return [];
    return scenarios.map((scenario) => {
      const clientWithParams = {
        ...currentClient,
        projectionParams: scenario.params,
      };
      const projections = generateProjections(clientWithParams);
      const metrics = calculateKeyMetrics(projections, scenario.params);
      return {
        name: scenario.name,
        params: scenario.params,
        metrics,
      };
    });
  }, [currentClient, scenarios]);

  // Chart data for bar comparison
  const chartData = useMemo(() => {
    if (results.length === 0) return [];

    const metrics = [
      {
        metric: 'Income Replacement',
        ...Object.fromEntries(
          results.map((r) => [r.name, Math.round(r.metrics.incomeReplacementRatio * 100)])
        ),
      },
      {
        metric: 'Money Lasts Until',
        ...Object.fromEntries(
          results.map((r) => [r.name, r.metrics.moneyLastsUntilAge ?? 95])
        ),
      },
      {
        metric: 'Lifetime Tax ($K)',
        ...Object.fromEntries(
          results.map((r) => [r.name, Math.round(r.metrics.totalLifetimeTax / 1000)])
        ),
      },
      {
        metric: 'Surplus at 95 ($K)',
        ...Object.fromEntries(
          results.map((r) => [r.name, Math.round((r.metrics.surplusAtAge95 ?? 0) / 1000)])
        ),
      },
    ];

    return metrics;
  }, [results]);

  // Handlers
  const handleScenarioChange = useCallback(
    (index: number, updates: Partial<ScenarioConfig>) => {
      setScenarios((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
      );
    },
    [],
  );

  const handleRemoveScenario = useCallback(
    (index: number) => {
      setScenarios((prev) => prev.filter((_, i) => i !== index));
    },
    [],
  );

  const handleAddScenario = useCallback(() => {
    if (scenarios.length >= 3) return;
    setScenarios((prev) => [
      ...prev,
      {
        name: `Scenario ${prev.length + 1}`,
        params: { ...defaultParams },
      },
    ]);
  }, [scenarios.length, defaultParams]);

  const handleApplyPreset = useCallback(
    (preset: Preset) => {
      const newScenarios: ScenarioConfig[] = preset.scenarios.map((ps) => ({
        name: ps.name,
        params: { ...defaultParams, ...ps.overrides },
      }));
      setScenarios(newScenarios);
    },
    [defaultParams],
  );

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
  /*  Render                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-serif text-2xl text-navy tracking-wide">
          Scenario Comparison
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Compare up to 3 scenarios side by side for{' '}
          <span className="font-medium text-text-primary">
            {currentClient.firstName} {currentClient.lastName}
          </span>
          .
        </p>
      </div>

      {/* Quick Presets */}
      <Card title="Quick Presets">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleApplyPreset(preset)}
              className="text-left rounded-lg border border-card-border p-3 hover:border-navy hover:bg-bg-secondary/50 transition-colors"
            >
              <p className="text-sm font-medium text-navy">{preset.label}</p>
              <p className="text-xs text-text-secondary mt-0.5">{preset.description}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Scenario Editors */}
      <Card title="Scenario Parameters">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scenario, i) => (
            <ParamEditor
              key={i}
              scenario={scenario}
              index={i}
              onChange={handleScenarioChange}
              onRemove={handleRemoveScenario}
              canRemove={scenarios.length > 2}
              color={SCENARIO_COLORS[i]}
            />
          ))}

          {scenarios.length < 3 && (
            <button
              onClick={handleAddScenario}
              className="rounded-lg border-2 border-dashed border-card-border p-4 flex items-center justify-center gap-2 text-sm text-text-secondary hover:border-navy hover:text-navy transition-colors min-h-[200px]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5.5v5M5.5 8h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Add Scenario
            </button>
          )}
        </div>
      </Card>

      {/* Side-by-Side Comparison Table */}
      {results.length > 0 && (
        <Card title="Side-by-Side Comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Metric
                  </th>
                  {results.map((r, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                      style={{ color: SCENARIO_COLORS[i] }}
                    >
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border/50">
                {/* Key differing parameters */}
                <MetricRow
                  label="Retirement Age"
                  values={results.map((r) => r.params.retirementAge)}
                  highlight
                />
                <MetricRow
                  label="CPP Start Age"
                  values={results.map((r) => r.params.cppStartAge)}
                />
                <MetricRow
                  label="OAS Start Age"
                  values={results.map((r) => r.params.oasStartAge)}
                  highlight
                />
                <MetricRow
                  label="RRSP Return Rate"
                  values={results.map((r) => r.params.rrspReturnRate)}
                  format="percent"
                />
                <MetricRow
                  label="Spending Rate"
                  values={results.map((r) => r.params.retirementSpendingRate)}
                  format="percent"
                  highlight
                />

                {/* Separator */}
                <tr>
                  <td
                    colSpan={results.length + 1}
                    className="px-4 py-2 bg-navy/5 text-xs font-semibold text-navy uppercase tracking-wider"
                  >
                    Results
                  </td>
                </tr>

                {/* Outcome metrics */}
                <MetricRow
                  label="Income Replacement Ratio"
                  values={results.map((r) => r.metrics.incomeReplacementRatio)}
                  format="percent"
                />
                <MetricRow
                  label="Money Lasts Until"
                  values={results.map((r) => r.metrics.moneyLastsUntilAge)}
                  format="age"
                  highlight
                />
                <MetricRow
                  label="Total Lifetime Tax"
                  values={results.map((r) => r.metrics.totalLifetimeTax)}
                  format="currency"
                />
                <MetricRow
                  label="Surplus at Age 95"
                  values={results.map((r) => r.metrics.surplusAtAge95 ?? 0)}
                  format="currency"
                  highlight
                />
                <MetricRow
                  label="CPP + OAS % of Retirement Income"
                  values={results.map((r) => r.metrics.cppOasPercentOfRetirementIncome)}
                  format="percent"
                />
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Visual Chart Comparison */}
      {chartData.length > 0 && (
        <Card title="Visual Comparison">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="rect"
                iconSize={10}
                wrapperStyle={{ fontSize: 11 }}
              />
              {results.map((r, i) => (
                <Bar key={r.name} dataKey={r.name} fill={SCENARIO_COLORS[i]} radius={[4, 4, 0, 0]}>
                  {chartData.map((_entry, idx) => (
                    <Cell key={idx} fill={SCENARIO_COLORS[i]} fillOpacity={0.85} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-text-secondary mt-2 text-center">
            Income Replacement (%), Money Lasts Until (age), Lifetime Tax ($K), Surplus at 95 ($K)
          </p>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <button
          onClick={() => navigate(`/client/${id}/projections`)}
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
          Back: Projections
        </button>

        <button
          onClick={() => navigate(`/client/${id}/summary`)}
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
