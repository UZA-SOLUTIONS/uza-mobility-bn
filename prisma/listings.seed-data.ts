import type {
  BodyType,
  ConditionLevel,
  DrivetrainType,
  PowertrainType,
  SteeringPosition,
  UseCase,
  VerificationLevel,
} from '@prisma/client';

export type ListingSeedEvSpec = {
  batteryCapacityKwh: number;
  batteryHealthPercent?: number;
  batteryHealthReport: boolean;
  rangeKm: number;
  chargingType: string;
  fastChargingSupported: boolean;
  chargingTimeHours: number;
  motorPowerKw: number;
  topSpeedKmh: number;
  payloadCapacityKg?: number;
  grossVehicleWeightKg?: number;
  seatingCapacity?: number;
};

export type ListingSeedVehicle = {
  slug: string;
  listingTitle: string;
  brand: string;
  model: string;
  trim?: string;
  categorySlug: string;
  subcategoryName: string;
  manufacturingYear: number;
  isNew: boolean;
  condition: ConditionLevel;
  bodyType: BodyType;
  powertrainType: PowertrainType;
  color: string;
  seats: number;
  steeringPosition: SteeringPosition;
  drivetrain: DrivetrainType;
  mileageKm?: number;
  hasWarranty: boolean;
  warrantyDetails: string;
  hasAccidentHistory: boolean;
  ownershipCount: number;
  registrationStatus: string;
  vehicleLocation: string;
  city: string;
  country: string;
  deliveryEstimateDays: number;
  description: string;
  verificationLevel: VerificationLevel;
  isFeatured: boolean;
  isHotDeal: boolean;
  useCases: UseCase[];
  basePriceUsd: number;
  discountUsd?: number;
  evSpecs: ListingSeedEvSpec;
  /** Filenames under `docs/images/`. */
  imageFiles: string[];
};

/** Demo inventory mapped from `docs/images` vehicle photos. */
export const listingSeedVehicles: ListingSeedVehicle[] = [
  {
    slug: 'weltmeister-ex5-2019',
    listingTitle: '2019 Weltmeister EX5 — UZA Inspected SUV',
    brand: 'Weltmeister',
    model: 'EX5',
    trim: 'Pro',
    categorySlug: 'passenger-ev',
    subcategoryName: 'SUV',
    manufacturingYear: 2019,
    isNew: false,
    condition: 'VERY_GOOD',
    bodyType: 'SUV',
    powertrainType: 'BEV',
    color: 'Pearl White',
    seats: 5,
    steeringPosition: 'LEFT_HAND_DRIVE',
    drivetrain: 'FWD',
    mileageKm: 42_500,
    hasWarranty: true,
    warrantyDetails: '6-month UZA battery health guarantee on verified pack.',
    hasAccidentHistory: false,
    ownershipCount: 1,
    registrationStatus: 'Registered in Rwanda',
    vehicleLocation: 'UZA Kigali showroom — Nyarutarama',
    city: 'Kigali',
    country: 'RW',
    deliveryEstimateDays: 2,
    description:
      'Compact electric SUV with strong range for city and highway use. UZA-inspected battery, CCS fast charging, and ready for immediate handover in Kigali.',
    verificationLevel: 'UZA_INSPECTED',
    isFeatured: true,
    isHotDeal: false,
    useCases: ['FAMILY', 'PERSONAL_MOBILITY'],
    basePriceUsd: 18_500,
    evSpecs: {
      batteryCapacityKwh: 52.5,
      batteryHealthPercent: 88,
      batteryHealthReport: true,
      rangeKm: 460,
      chargingType: 'CCS2 DC / Type 2 AC',
      fastChargingSupported: true,
      chargingTimeHours: 0.75,
      motorPowerKw: 160,
      topSpeedKmh: 185,
      grossVehicleWeightKg: 1_750,
      seatingCapacity: 5,
    },
    imageFiles: [
      '1280px-2019_Weltmeister_EX5_(front).jpg',
      '1280px-2019_Weltmeister_EX5_(rear).jpg',
    ],
  },
  {
    slug: 'nammi-06-2024',
    listingTitle: '2024 Nammi 06 — City EV Hatchback',
    brand: 'Nammi',
    model: '06',
    categorySlug: 'passenger-ev',
    subcategoryName: 'Hatchback',
    manufacturingYear: 2024,
    isNew: true,
    condition: 'NEW',
    bodyType: 'HATCHBACK',
    powertrainType: 'BEV',
    color: 'Sky Blue',
    seats: 5,
    steeringPosition: 'LEFT_HAND_DRIVE',
    drivetrain: 'FWD',
    mileageKm: 120,
    hasWarranty: true,
    warrantyDetails: 'Manufacturer warranty plus UZA delivery support.',
    hasAccidentHistory: false,
    ownershipCount: 0,
    registrationStatus: 'Ready for first registration',
    vehicleLocation: 'UZA Kigali showroom — Nyarutarama',
    city: 'Kigali',
    country: 'RW',
    deliveryEstimateDays: 1,
    description:
      'Light, efficient hatchback ideal for urban commuting. New stock with full EV specs, AC home charging cable included.',
    verificationLevel: 'UZA_VERIFIED',
    isFeatured: false,
    isHotDeal: true,
    useCases: ['PERSONAL_MOBILITY', 'LAST_MILE'],
    basePriceUsd: 14_200,
    evSpecs: {
      batteryCapacityKwh: 37.3,
      batteryHealthReport: true,
      rangeKm: 430,
      chargingType: 'GB/T DC / Type 2 AC',
      fastChargingSupported: true,
      chargingTimeHours: 0.5,
      motorPowerKw: 95,
      topSpeedKmh: 150,
      grossVehicleWeightKg: 1_280,
      seatingCapacity: 5,
    },
    imageFiles: [
      '1280px-Nammi_06_001.jpg',
      '1280px-Nammi_06_002.jpg',
    ],
  },
  {
    slug: 'chevrolet-volt-2011',
    listingTitle: '2011 Chevrolet Volt — Extended-Range Electric',
    brand: 'Chevrolet',
    model: 'Volt',
    categorySlug: 'passenger-ev',
    subcategoryName: 'Hatchback',
    manufacturingYear: 2011,
    isNew: false,
    condition: 'EXCELLENT',
    bodyType: 'HATCHBACK',
    powertrainType: 'PHEV',
    color: 'Switchblade Silver',
    seats: 5,
    steeringPosition: 'LEFT_HAND_DRIVE',
    drivetrain: 'FWD',
    mileageKm: 96_000,
    hasWarranty: true,
    warrantyDetails: '90-day UZA powertrain support on imported unit.',
    hasAccidentHistory: false,
    ownershipCount: 2,
    registrationStatus: 'Registered in Rwanda',
    vehicleLocation: 'UZA Kigali showroom — Nyarutarama',
    city: 'Kigali',
    country: 'RW',
    deliveryEstimateDays: 2,
    description:
      'Proven plug-in hatchback with EV-first driving and petrol range extender. Excellent for buyers transitioning from ICE with flexible charging.',
    verificationLevel: 'UZA_REVIEWED',
    isFeatured: false,
    isHotDeal: false,
    useCases: ['FAMILY', 'TAXI', 'PERSONAL_MOBILITY'],
    basePriceUsd: 11_500,
    evSpecs: {
      batteryCapacityKwh: 16.5,
      batteryHealthPercent: 82,
      batteryHealthReport: true,
      rangeKm: 56,
      chargingType: 'J1772 AC',
      fastChargingSupported: false,
      chargingTimeHours: 4,
      motorPowerKw: 111,
      topSpeedKmh: 161,
      grossVehicleWeightKg: 1_720,
      seatingCapacity: 5,
    },
    imageFiles: [
      '1280px-Chevrolet_Volt_D2UX_Switchblade_Silver_(11).jpg',
      '1280px-2011_Chevrolet_Volt_--_NHTSA_1.jpg',
    ],
  },
  {
    slug: 'hozon-neta-u-2023',
    listingTitle: '2023 Hozon Neta U — Compact Electric SUV',
    brand: 'Hozon',
    model: 'Neta U',
    trim: '400',
    categorySlug: 'passenger-ev',
    subcategoryName: 'Crossover',
    manufacturingYear: 2023,
    isNew: false,
    condition: 'EXCELLENT',
    bodyType: 'CROSSOVER',
    powertrainType: 'BEV',
    color: 'Grey',
    seats: 5,
    steeringPosition: 'LEFT_HAND_DRIVE',
    drivetrain: 'FWD',
    mileageKm: 18_200,
    hasWarranty: true,
    warrantyDetails: '12-month UZA battery assurance on inspected pack.',
    hasAccidentHistory: false,
    ownershipCount: 1,
    registrationStatus: 'Registered in Rwanda',
    vehicleLocation: 'UZA Kigali showroom — Nyarutarama',
    city: 'Kigali',
    country: 'RW',
    deliveryEstimateDays: 2,
    description:
      'Spacious crossover with long electric range and modern cabin. Low mileage, DC fast charge capable, ideal for family and fleet pilots.',
    verificationLevel: 'UZA_INSPECTED',
    isFeatured: true,
    isHotDeal: false,
    useCases: ['FAMILY', 'CORPORATE', 'FLEET'],
    basePriceUsd: 16_800,
    evSpecs: {
      batteryCapacityKwh: 68,
      batteryHealthPercent: 94,
      batteryHealthReport: true,
      rangeKm: 420,
      chargingType: 'CCS2 DC / Type 2 AC',
      fastChargingSupported: true,
      chargingTimeHours: 0.65,
      motorPowerKw: 150,
      topSpeedKmh: 180,
      grossVehicleWeightKg: 1_810,
      seatingCapacity: 5,
    },
    imageFiles: [
      '1280px-Hozon_U_001.jpg',
      '1280px-2023_Hozon-Neta_U,_rear_8.17.23.jpg',
      '1280px-Hozon_Neta_U_interior.jpg',
    ],
  },
];
