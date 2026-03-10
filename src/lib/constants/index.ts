import type { CanadianProvince } from '../types';

// Federal tax brackets 2025
export const FEDERAL_TAX_BRACKETS = [
  { min: 0, max: 57375, rate: 0.15 },
  { min: 57375, max: 114750, rate: 0.205 },
  { min: 114750, max: 158468, rate: 0.26 },
  { min: 158468, max: 220000, rate: 0.29 },
  { min: 220000, max: Infinity, rate: 0.33 },
];

export const FEDERAL_BASIC_PERSONAL_AMOUNT = 16129;

// Ontario tax brackets 2025
export const ONTARIO_TAX_BRACKETS = [
  { min: 0, max: 52886, rate: 0.0505 },
  { min: 52886, max: 105775, rate: 0.0915 },
  { min: 105775, max: 150000, rate: 0.1116 },
  { min: 150000, max: 220000, rate: 0.1216 },
  { min: 220000, max: Infinity, rate: 0.1316 },
];

export const ONTARIO_BASIC_PERSONAL_AMOUNT = 11865;

// Provincial tax brackets (simplified for MVP — Ontario is the primary province)
export const PROVINCIAL_TAX_DATA: Record<CanadianProvince, {
  brackets: { min: number; max: number; rate: number }[];
  personalAmount: number;
}> = {
  ON: { brackets: ONTARIO_TAX_BRACKETS, personalAmount: ONTARIO_BASIC_PERSONAL_AMOUNT },
  AB: { brackets: [{ min: 0, max: 148269, rate: 0.10 }, { min: 148269, max: 177922, rate: 0.12 }, { min: 177922, max: 237230, rate: 0.13 }, { min: 237230, max: 355845, rate: 0.14 }, { min: 355845, max: Infinity, rate: 0.15 }], personalAmount: 21885 },
  BC: { brackets: [{ min: 0, max: 47937, rate: 0.0506 }, { min: 47937, max: 95875, rate: 0.077 }, { min: 95875, max: 110076, rate: 0.105 }, { min: 110076, max: 133664, rate: 0.1229 }, { min: 133664, max: 181232, rate: 0.147 }, { min: 181232, max: 252752, rate: 0.168 }, { min: 252752, max: Infinity, rate: 0.205 }], personalAmount: 12580 },
  MB: { brackets: [{ min: 0, max: 47000, rate: 0.108 }, { min: 47000, max: 100000, rate: 0.1275 }, { min: 100000, max: Infinity, rate: 0.174 }], personalAmount: 15780 },
  NB: { brackets: [{ min: 0, max: 49958, rate: 0.094 }, { min: 49958, max: 99916, rate: 0.14 }, { min: 99916, max: 185064, rate: 0.16 }, { min: 185064, max: Infinity, rate: 0.195 }], personalAmount: 13044 },
  NL: { brackets: [{ min: 0, max: 43198, rate: 0.087 }, { min: 43198, max: 86395, rate: 0.145 }, { min: 86395, max: 154244, rate: 0.158 }, { min: 154244, max: 215943, rate: 0.178 }, { min: 215943, max: 275870, rate: 0.198 }, { min: 275870, max: 551739, rate: 0.208 }, { min: 551739, max: 1103478, rate: 0.213 }, { min: 1103478, max: Infinity, rate: 0.218 }], personalAmount: 10818 },
  NS: { brackets: [{ min: 0, max: 29590, rate: 0.0879 }, { min: 29590, max: 59180, rate: 0.1495 }, { min: 59180, max: 93000, rate: 0.1667 }, { min: 93000, max: 150000, rate: 0.175 }, { min: 150000, max: Infinity, rate: 0.21 }], personalAmount: 8481 },
  PE: { brackets: [{ min: 0, max: 32656, rate: 0.098 }, { min: 32656, max: 64313, rate: 0.138 }, { min: 64313, max: Infinity, rate: 0.167 }], personalAmount: 12750 },
  SK: { brackets: [{ min: 0, max: 52057, rate: 0.105 }, { min: 52057, max: 148734, rate: 0.125 }, { min: 148734, max: Infinity, rate: 0.145 }], personalAmount: 17661 },
  QC: { brackets: [{ min: 0, max: 51780, rate: 0.14 }, { min: 51780, max: 103545, rate: 0.19 }, { min: 103545, max: 126000, rate: 0.24 }, { min: 126000, max: Infinity, rate: 0.2575 }], personalAmount: 18056 },
  NT: { brackets: [{ min: 0, max: 50597, rate: 0.059 }, { min: 50597, max: 101198, rate: 0.086 }, { min: 101198, max: 164525, rate: 0.122 }, { min: 164525, max: Infinity, rate: 0.1405 }], personalAmount: 16593 },
  NU: { brackets: [{ min: 0, max: 53268, rate: 0.04 }, { min: 53268, max: 106537, rate: 0.07 }, { min: 106537, max: 173205, rate: 0.09 }, { min: 173205, max: Infinity, rate: 0.115 }], personalAmount: 17925 },
  YT: { brackets: [{ min: 0, max: 57375, rate: 0.064 }, { min: 57375, max: 114750, rate: 0.09 }, { min: 114750, max: 158468, rate: 0.109 }, { min: 158468, max: 500000, rate: 0.128 }, { min: 500000, max: Infinity, rate: 0.15 }], personalAmount: 16129 },
};

// CPP constants
export const CPP_YMPE_2025 = 71300; // Year's Maximum Pensionable Earnings
export const CPP_BASIC_EXEMPTION = 3500;
export const CPP_MAX_MONTHLY_2025 = 1364.60;
export const CPP_EARLY_REDUCTION_PER_MONTH = 0.006; // 0.6% per month before 65
export const CPP_LATE_ENHANCEMENT_PER_MONTH = 0.007; // 0.7% per month after 65
export const CPP_EARLIEST_AGE = 60;
export const CPP_LATEST_AGE = 70;

// OAS constants
export const OAS_MAX_MONTHLY_65_74 = 727.67;
export const OAS_MAX_MONTHLY_75_PLUS = 800.44;
export const OAS_EARLIEST_AGE = 65;
export const OAS_LATEST_AGE = 70;
export const OAS_DEFERRAL_INCREASE_PER_MONTH = 0.006; // 0.6% per month
export const OAS_CLAWBACK_THRESHOLD = 90997;
export const OAS_CLAWBACK_RATE = 0.15;

// RRSP constants
export const RRSP_CONTRIBUTION_RATE = 0.18;
export const RRSP_MAX_CONTRIBUTION_2025 = 32490;
export const RRSP_TO_RRIF_AGE = 71;

// RRIF minimum withdrawal rates
export const RRIF_MIN_WITHDRAWAL_RATES: Record<number, number> = {
  65: 0.0400, 66: 0.0417, 67: 0.0435, 68: 0.0454, 69: 0.0476,
  70: 0.0500, 71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567,
  75: 0.0582, 76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658,
  80: 0.0682, 81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808,
  85: 0.0851, 86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099,
  90: 0.1192, 91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1853,
  95: 0.2000,
};

// FHSA constants
export const FHSA_ANNUAL_LIMIT = 8000;
export const FHSA_LIFETIME_LIMIT = 40000;

// TFSA constants
export const TFSA_ANNUAL_ROOM = 7000;

// RESP / CESG constants
export const RESP_ANNUAL_CONTRIBUTION_MAX = 2500; // per child for CESG purposes
export const RESP_LIFETIME_LIMIT = 50000; // per beneficiary
export const CESG_RATE = 0.20; // 20% match
export const CESG_ANNUAL_MAX = 500; // per beneficiary
export const CESG_LIFETIME_MAX = 7200; // per beneficiary
export const RESP_BENEFICIARY_MAX_AGE = 17; // CESG eligibility ends after 17

// GIS (Guaranteed Income Supplement) constants — 2025
// Single: max $1,086.88/month, clawback at 50% of income above $0
// Couple: max $654.23/month each, clawback at 25% of combined income
export const GIS_MAX_MONTHLY_SINGLE = 1086.88;
export const GIS_MAX_MONTHLY_COUPLE = 654.23;
export const GIS_INCOME_THRESHOLD_SINGLE = 21768; // annual income cutoff (approx)
export const GIS_INCOME_THRESHOLD_COUPLE = 28560;
export const GIS_CLAWBACK_RATE_SINGLE = 0.50;
export const GIS_CLAWBACK_RATE_COUPLE = 0.25;

// Probate fees by province (simplified schedules)
// Returns fee based on estate value
export function calculateProbateFee(province: string, estateValue: number): number {
  if (estateValue <= 0) return 0;
  switch (province) {
    case 'ON': // Ontario: $5 per $1,000 for first $50K, then $15 per $1,000
      if (estateValue <= 50000) return Math.round(estateValue / 1000 * 5);
      return Math.round(250 + (estateValue - 50000) / 1000 * 15);
    case 'BC': // BC: $0 for ≤$25K, $6/$1K for $25K-$50K, $14/$1K over $50K
      if (estateValue <= 25000) return 0;
      if (estateValue <= 50000) return Math.round((estateValue - 25000) / 1000 * 6);
      return Math.round(150 + (estateValue - 50000) / 1000 * 14);
    case 'AB': return 525; // Alberta: flat $525 max
    case 'QC': return Math.min(estateValue * 0.005, 65); // Quebec: max $65
    case 'SK': return Math.round(estateValue * 0.007); // Saskatchewan: $7 per $1,000
    case 'MB': return Math.round(estateValue * 0.007); // Manitoba: $7 per $1,000
    case 'NB': return Math.round(estateValue * 0.005); // New Brunswick: $5 per $1,000
    case 'NS': // Nova Scotia: tiered schedule
      if (estateValue <= 10000) return 85;
      if (estateValue <= 25000) return 215;
      if (estateValue <= 50000) return 360;
      if (estateValue <= 100000) return 1002;
      return Math.round(1002 + (estateValue - 100000) / 1000 * 16.95);
    case 'NL': return Math.round(estateValue * 0.006); // Newfoundland: $6 per $1,000
    case 'PE': return Math.round(estateValue * 0.004); // PEI: $4 per $1,000
    default: return Math.round(estateValue * 0.005); // Territories: estimate
  }
}

// Province display names
export const PROVINCE_NAMES: Record<string, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

// Discovery priority categories
export const PRIORITY_CATEGORIES = [
  {
    name: 'Estate Planning',
    items: ['Wills/POA', 'Trusts', 'Life Insurance', 'Heirs', 'Charities', 'Taxes'],
  },
  {
    name: 'Retirement',
    items: ['Investments', 'Pensions', 'Annuities', 'RRSP', 'RRIF', 'TFSA'],
  },
  {
    name: 'Income Protection',
    items: ['Disability', 'Asset Protection', 'Life Insurance', 'Critical Illness', 'Health Plan', 'Business'],
  },
  {
    name: 'Assisting Children',
    items: ['College/University', 'Living Expenses', 'Down Payment', 'Wedding'],
  },
  {
    name: 'Assisting Parents',
    items: ['Retirement', 'Long-term Care', 'Safety Needs', 'Your Time Involvement'],
  },
  {
    name: 'Other',
    items: [],
  },
];
