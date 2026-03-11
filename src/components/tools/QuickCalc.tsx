import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMarginalTaxRate } from '../../lib/calculations';
import type { CanadianProvince } from '../../lib/types';
import { PROVINCE_NAMES } from '../../lib/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDetailed(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Input component
// ---------------------------------------------------------------------------

function CalcInput({
  label,
  value,
  onChange,
  suffix,
  prefix = '$',
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          max={max}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-1.5 ${highlight ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compound Growth Calculator
// ---------------------------------------------------------------------------

function CompoundGrowthCalc() {
  const [principal, setPrincipal] = useState(10000);
  const [annual, setAnnual] = useState(6000);
  const [rate, setRate] = useState(5);
  const [years, setYears] = useState(20);

  const result = useMemo(() => {
    const r = rate / 100;
    let balance = principal;
    let totalContributions = principal;
    for (let i = 0; i < years; i++) {
      balance = balance * (1 + r) + annual;
      totalContributions += annual;
    }
    return {
      futureValue: Math.round(balance),
      totalContributions: Math.round(totalContributions),
      totalGrowth: Math.round(balance - totalContributions),
    };
  }, [principal, annual, rate, years]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <CalcInput label="Starting Amount" value={principal} onChange={setPrincipal} />
        <CalcInput label="Annual Contribution" value={annual} onChange={setAnnual} />
        <CalcInput label="Return Rate" value={rate} onChange={setRate} prefix="" suffix="%" step={0.1} />
        <CalcInput label="Years" value={years} onChange={setYears} prefix="" suffix="yrs" min={1} max={50} />
      </div>
      <div className="border-t border-gray-200 pt-3">
        <ResultRow label="Future Value" value={fmt(result.futureValue)} highlight />
        <ResultRow label="Total Contributions" value={fmt(result.totalContributions)} />
        <ResultRow label="Investment Growth" value={fmt(result.totalGrowth)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mortgage Payment Calculator
// ---------------------------------------------------------------------------

function MortgageCalc() {
  const [balance, setBalance] = useState(400000);
  const [rate, setRate] = useState(5.0);
  const [amort, setAmort] = useState(25);

  const result = useMemo(() => {
    const monthlyRate = rate / 100 / 12;
    const totalPayments = amort * 12;
    if (monthlyRate === 0) {
      const monthly = balance / totalPayments;
      return { monthly, totalPaid: balance, totalInterest: 0 };
    }
    const monthly = balance * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))
      / (Math.pow(1 + monthlyRate, totalPayments) - 1);
    const totalPaid = monthly * totalPayments;
    return {
      monthly: Math.round(monthly * 100) / 100,
      totalPaid: Math.round(totalPaid),
      totalInterest: Math.round(totalPaid - balance),
    };
  }, [balance, rate, amort]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <CalcInput label="Mortgage Balance" value={balance} onChange={setBalance} />
        <CalcInput label="Interest Rate" value={rate} onChange={setRate} prefix="" suffix="%" step={0.05} />
        <CalcInput label="Amortization" value={amort} onChange={setAmort} prefix="" suffix="yrs" min={1} max={30} />
      </div>
      <div className="border-t border-gray-200 pt-3">
        <ResultRow label="Monthly Payment" value={fmtDetailed(result.monthly)} highlight />
        <ResultRow label="Total Paid Over Life" value={fmt(result.totalPaid)} />
        <ResultRow label="Total Interest" value={fmt(result.totalInterest)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RRSP vs TFSA Quick Compare
// ---------------------------------------------------------------------------

function RrspVsTfsaCalc() {
  const [amount, setAmount] = useState(10000);
  const [marginalRate, setMarginalRate] = useState(37);
  const [retirementRate, setRetirementRate] = useState(25);
  const [returnRate, setReturnRate] = useState(5);
  const [years, setYears] = useState(20);

  const result = useMemo(() => {
    const r = returnRate / 100;
    const mr = marginalRate / 100;
    const rr = retirementRate / 100;

    // RRSP: invest full amount (tax-deferred), pay tax on withdrawal
    const rrspGross = amount; // pre-tax dollar
    const rrspFuture = rrspGross * Math.pow(1 + r, years);
    const rrspAfterTax = rrspFuture * (1 - rr);

    // TFSA: invest after-tax amount, no tax on withdrawal
    const tfsaContrib = amount * (1 - mr); // after-tax dollar
    const tfsaFuture = tfsaContrib * Math.pow(1 + r, years);

    // RRSP tax refund reinvested in TFSA
    const refund = amount * mr;
    const refundGrown = refund * Math.pow(1 + r, years);

    return {
      rrspAfterTax: Math.round(rrspAfterTax),
      tfsaFuture: Math.round(tfsaFuture),
      rrspWithRefund: Math.round(rrspAfterTax + refundGrown),
      refundGrown: Math.round(refundGrown),
      winner: rrspAfterTax + refundGrown > tfsaFuture ? 'RRSP' : 'TFSA',
    };
  }, [amount, marginalRate, retirementRate, returnRate, years]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <CalcInput label="Pre-Tax Amount" value={amount} onChange={setAmount} />
        <CalcInput label="Current Marginal Rate" value={marginalRate} onChange={setMarginalRate} prefix="" suffix="%" />
        <CalcInput label="Retirement Marginal Rate" value={retirementRate} onChange={setRetirementRate} prefix="" suffix="%" />
        <CalcInput label="Return Rate" value={returnRate} onChange={setReturnRate} prefix="" suffix="%" step={0.1} />
        <CalcInput label="Years to Retirement" value={years} onChange={setYears} prefix="" suffix="yrs" />
      </div>
      <div className="border-t border-gray-200 pt-3">
        <ResultRow label="RRSP (after withdrawal tax)" value={fmt(result.rrspAfterTax)} />
        <ResultRow label="RRSP + Refund Reinvested" value={fmt(result.rrspWithRefund)} highlight />
        <ResultRow label="TFSA (tax-free)" value={fmt(result.tfsaFuture)} highlight />
        <div className="mt-2 text-xs text-amber-600 font-medium">
          {result.winner === 'RRSP'
            ? 'RRSP wins when current marginal rate > retirement rate'
            : 'TFSA wins when retirement rate >= current rate'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Tax Estimator
// ---------------------------------------------------------------------------

function TaxEstimator() {
  const [income, setIncome] = useState(120000);
  const [province, setProvince] = useState<CanadianProvince>('ON');

  const result = useMemo(() => {
    const marginal = getMarginalTaxRate(income, province);
    // Simple estimate: use the calculation engine
    // For a quick estimate, approximate using average of brackets
    const fedBasic = 15705;
    const provBasic = 11865; // ON approximate
    const effectiveIncome = Math.max(0, income - fedBasic);
    // Rough federal tax
    let fedTax = 0;
    if (effectiveIncome > 0) fedTax += Math.min(effectiveIncome, 55867) * 0.15;
    if (effectiveIncome > 55867) fedTax += Math.min(effectiveIncome - 55867, 55867) * 0.205;
    if (effectiveIncome > 111733) fedTax += Math.min(effectiveIncome - 111733, 43562) * 0.26;
    if (effectiveIncome > 155295) fedTax += Math.min(effectiveIncome - 155295, 66836) * 0.29;
    if (effectiveIncome > 222131) fedTax += (effectiveIncome - 222131) * 0.33;
    // Rough provincial (ON simplified)
    const provIncome = Math.max(0, income - provBasic);
    let provTax = 0;
    if (provIncome > 0) provTax += Math.min(provIncome, 51446) * 0.0505;
    if (provIncome > 51446) provTax += Math.min(provIncome - 51446, 51454) * 0.0915;
    if (provIncome > 102900) provTax += Math.min(provIncome - 102900, 47050) * 0.1116;
    if (provIncome > 149950) provTax += Math.min(provIncome - 149950, 70050) * 0.1216;
    if (provIncome > 220000) provTax += (provIncome - 220000) * 0.1316;

    const totalTax = Math.round(fedTax + provTax);
    const effectiveRate = income > 0 ? totalTax / income : 0;
    const afterTax = income - totalTax;

    return { totalTax, effectiveRate, afterTax, marginal, fedTax: Math.round(fedTax), provTax: Math.round(provTax) };
  }, [income, province]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <CalcInput label="Annual Income" value={income} onChange={setIncome} />
        <div>
          <label className="block text-xs text-slate-500 mb-1">Province</label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value as CanadianProvince)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
          >
            {Object.entries(PROVINCE_NAMES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-3">
        <ResultRow label="Federal Tax" value={fmt(result.fedTax)} />
        <ResultRow label="Provincial Tax" value={fmt(result.provTax)} />
        <ResultRow label="Total Tax" value={fmt(result.totalTax)} highlight />
        <ResultRow label="After-Tax Income" value={fmt(result.afterTax)} highlight />
        <ResultRow label="Effective Rate" value={`${(result.effectiveRate * 100).toFixed(1)}%`} />
        <ResultRow label="Marginal Rate" value={`${(result.marginal * 100).toFixed(1)}%`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type CalcTab = 'growth' | 'mortgage' | 'rrsp-tfsa' | 'tax';

const CALC_TABS: { id: CalcTab; label: string; icon: string }[] = [
  { id: 'growth', label: 'Compound Growth', icon: '📈' },
  { id: 'mortgage', label: 'Mortgage', icon: '🏠' },
  { id: 'rrsp-tfsa', label: 'RRSP vs TFSA', icon: '⚖️' },
  { id: 'tax', label: 'Tax Estimate', icon: '🧾' },
];

export default function QuickCalc() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CalcTab>('growth');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-600 mb-4 transition-colors group"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          <h1 className="text-xl font-semibold text-slate-800">Quick Calculators</h1>
          <p className="text-sm text-slate-500 mt-1">
            Standalone financial planning tools — no client data required.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-6">
          {CALC_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Calculator cards */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {activeTab === 'growth' && <CompoundGrowthCalc />}
          {activeTab === 'mortgage' && <MortgageCalc />}
          {activeTab === 'rrsp-tfsa' && <RrspVsTfsaCalc />}
          {activeTab === 'tax' && <TaxEstimator />}
        </div>
      </div>
    </div>
  );
}
