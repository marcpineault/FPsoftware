export type CanadianProvince =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL'
  | 'NS' | 'NT' | 'NU' | 'ON' | 'PE'
  | 'QC' | 'SK' | 'YT';

export type EmploymentStatus = 'employed' | 'self-employed' | 'retired' | 'other';
export type PensionType = 'none' | 'db' | 'dc';
export type InsuranceType = 'term' | 'whole' | 'universal';
export type InsuranceSource = 'employer' | 'personal' | 'both';

export interface SpouseInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  employmentStatus: EmploymentStatus;
  annualIncome: number;
  targetRetirementAge: number;
  // Spouse's CPP/OAS
  estimatedCppMonthly: number;
  cppStartAge: number;
  oasStartAge: number;
  // Spouse's registered accounts
  rrspBalance: number;
  spousalRrspBalance: number; // Spousal RRSP (contributed by client, owned by spouse)
  tfsaBalance: number;
}

export interface PensionDetails {
  annualBenefitEstimate?: number;
  currentBalance?: number;
  annualContribution?: number;
}

export interface LifeInsuranceDetails {
  coverageAmount: number;
  type: InsuranceType;
  source: InsuranceSource;
}

export interface ChildInfo {
  name: string;
  dateOfBirth: string;
  respBalance: number;
}

export interface PriorityCategory {
  category: string;
  items: string[];
  notes: string;
}

export interface ProjectionParams {
  retirementAge: number;
  cppStartAge: number;
  oasStartAge: number;
  estimatedCppMonthly: number;
  inflationRate: number;
  rrspReturnRate: number;
  tfsaReturnRate: number;
  nonRegReturnRate: number;
  retirementSpendingRate: number;
  enablePensionSplitting: boolean;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  category: string;
}

export interface Client {
  id: string;
  createdAt: Date;
  updatedAt: Date;

  // Profile
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  province: CanadianProvince;
  employmentStatus: EmploymentStatus;
  annualIncome: number;
  targetRetirementAge: number;

  // Spouse
  hasSpouse: boolean;
  spouse?: SpouseInfo;

  // Financial snapshot
  rrspBalance: number;
  rrspAnnualContribution: number;
  tfsaBalance: number;
  tfsaAnnualContribution: number;
  fhsaBalance: number;
  fhsaAnnualContribution: number;
  nonRegisteredInvestments: number;
  // RESP
  children: ChildInfo[];
  respAnnualContribution: number; // total across all children
  pensionType: PensionType;
  pensionDetails?: PensionDetails;
  primaryResidenceValue: number;
  mortgageBalance: number;
  mortgageRate: number; // annual rate (e.g. 0.05 = 5%)
  mortgageAmortizationYears: number; // remaining amortization
  otherDebts: number;
  monthlyExpenses: number;

  // Insurance
  hasLifeInsurance: boolean;
  lifeInsuranceDetails?: LifeInsuranceDetails;
  hasDisabilityInsurance: boolean;
  hasCriticalIllness: boolean;

  // Discovery
  priorities: PriorityCategory[];
  priorityRanking: string[];

  // Projection parameters
  projectionParams: ProjectionParams;

  // Recommendations
  actionItems: ActionItem[];
  advisorNotes: string;

  // Module completion tracking
  discoveryComplete: boolean;
  profileComplete: boolean;
  projectionsViewed: boolean;
}

export interface ProjectionRow {
  year: number;
  age: number;
  spouseAge?: number;
  employmentIncome: number;
  spouseEmploymentIncome?: number;
  cpp: number;
  oas: number;
  oasClawback?: number;
  spouseCpp?: number;
  spouseOas?: number;
  gis?: number;
  pensionIncome: number;
  rrspRrifWithdrawals: number;
  rrifMinimumWithdrawal?: number;
  tfsaWithdrawals: number;
  nonRegWithdrawals: number;
  nonRegTaxableGain?: number;
  totalIncome: number;
  incomeTax: number;
  afterTaxIncome: number;
  expenses: number;
  netCashFlow: number;
  rrspRrifBalance: number;
  tfsaBalance: number;
  fhsaBalance: number;
  nonRegBalance: number;
  nonRegAcb?: number;
  respBalance: number;
  netWorth: number;
  isRetired: boolean;
  effectiveTaxRate?: number;
  pensionSplitSavings?: number;
}

export interface KeyMetrics {
  incomeReplacementRatio: number;
  moneyLastsUntilAge: number | null;
  surplusAtAge95: number | null;
  totalLifetimeTax: number;
  cppOasPercentOfRetirementIncome: number;
  oasClawbackYears?: number;
  avgEffectiveTaxRate?: number;
  totalOasClawback?: number;
}

export const DEFAULT_PROJECTION_PARAMS: ProjectionParams = {
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

export function createDefaultClient(id: string): Client {
  return {
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    province: 'ON',
    employmentStatus: 'employed',
    annualIncome: 0,
    targetRetirementAge: 65,
    hasSpouse: false,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    fhsaBalance: 0,
    fhsaAnnualContribution: 0,
    nonRegisteredInvestments: 0,
    children: [],
    respAnnualContribution: 0,
    pensionType: 'none',
    primaryResidenceValue: 0,
    mortgageBalance: 0,
    mortgageRate: 0.05,
    mortgageAmortizationYears: 25,
    otherDebts: 0,
    monthlyExpenses: 0,
    hasLifeInsurance: false,
    hasDisabilityInsurance: false,
    hasCriticalIllness: false,
    priorities: [],
    priorityRanking: [],
    projectionParams: { ...DEFAULT_PROJECTION_PARAMS },
    actionItems: [],
    advisorNotes: '',
    discoveryComplete: false,
    profileComplete: false,
    projectionsViewed: false,
  };
}
