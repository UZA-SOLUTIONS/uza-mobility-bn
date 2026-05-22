import { CategoryType } from '@prisma/client';

export interface EmissionsFactors {
  co2PerKmKg: number;
  fuelSavedPerKmL: number;
  annualKmEstimate: number;
}

export const EMISSIONS_FACTORS: Record<CategoryType, EmissionsFactors> = {
  [CategoryType.PASSENGER_EV]: {
    co2PerKmKg: 0.12,
    fuelSavedPerKmL: 0.07,
    annualKmEstimate: 20000,
  },
  [CategoryType.TWO_THREE_WHEEL]: {
    co2PerKmKg: 0.06,
    fuelSavedPerKmL: 0.035,
    annualKmEstimate: 15000,
  },
  [CategoryType.COMMERCIAL_EV]: {
    co2PerKmKg: 0.25,
    fuelSavedPerKmL: 0.15,
    annualKmEstimate: 40000,
  },
  [CategoryType.EV_PARTS_ACCESSORIES]: {
    co2PerKmKg: 0.05,
    fuelSavedPerKmL: 0.03,
    annualKmEstimate: 5000,
  },
  [CategoryType.EV_INFRASTRUCTURE_ENERGY]: {
    co2PerKmKg: 0.08,
    fuelSavedPerKmL: 0.04,
    annualKmEstimate: 10000,
  },
};

export const DEFAULT_EMISSIONS_FACTORS =
  EMISSIONS_FACTORS[CategoryType.PASSENGER_EV];

/** Standard estimate: ~21 kg CO2 absorbed per tree per year. */
export const CO2_KG_PER_TREE_YEAR = 21;
