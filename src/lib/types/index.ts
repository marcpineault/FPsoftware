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
  nonRegisteredInvestments: number;
  pensionType: PensionType;
  pensionDetails?: PensionDetails;
  primaryResidenceValue: number;
  mortgageBalance: number;
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
  cpp: number;
  oas: number;
  pensionIncome: number;
  rrspRrifWithdrawals: number;
  tfsaWithdrawals: number;
  nonRegWithdrawals: number;
  totalIncome: number;
  incomeTax: number;
  afterTaxIncome: number;
  expenses: number;
  netCashFlow: number;
  rrspRrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  netWorth: number;
  isRetired: boolean;
}

export interface KeyMetrics {
  incomeReplacementRatio: number;
  moneyLastsUntilAge: number | null;
  surplusAtAge95: number | null;
  totalLifetimeTax: number;
  cppOasPercentOfRetirementIncome: number;
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
    nonRegisteredInvestments: 0,
    pensionType: 'none',
    primaryResidenceValue: 0,
    mortgageBalance: 0,
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
