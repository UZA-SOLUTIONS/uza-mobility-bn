import { CategoryType } from '@prisma/client';

export const categorySeedData: Array<{
  name: string;
  slug: string;
  type: CategoryType;
  subcategories: string[];
}> = [
  {
    name: 'Passenger Electric Vehicles',
    slug: 'passenger-ev',
    type: CategoryType.PASSENGER_EV,
    subcategories: [
      'Sedan',
      'SUV',
      'Hatchback',
      'Crossover',
      'Coupe',
      'MPV',
      'Pick-up Truck',
      'Wagon',
      'Minivan',
    ],
  },
  {
    name: 'Electric Two & Three-Wheel',
    slug: 'two-three-wheel',
    type: CategoryType.TWO_THREE_WHEEL,
    subcategories: [
      'Electric Motorcycle',
      'Electric Scooter',
      'Electric Bicycle',
      'Electric Tricycle',
      'Electric Cargo Bike',
      'Electric Delivery Motorcycle',
    ],
  },
  {
    name: 'Commercial Electric Vehicles',
    slug: 'commercial-ev',
    type: CategoryType.COMMERCIAL_EV,
    subcategories: [
      'Electric Bus',
      'Electric Minibus',
      'Electric Van',
      'Electric Cargo Van',
      'Electric Truck',
      'Electric Light Truck',
      'Electric Heavy-Duty Truck',
      'Electric Utility Vehicle',
      'Electric Delivery Vehicle',
      'Electric Forklift',
      'Electric Industrial Vehicle',
      'Electric Shuttle',
    ],
  },
  {
    name: 'EV Parts & Accessories',
    slug: 'ev-parts',
    type: CategoryType.EV_PARTS_ACCESSORIES,
    subcategories: [
      'Batteries',
      'Battery Management Systems',
      'Charging Equipment',
      'Tires',
      'Brake Components',
      'Electric Motors',
      'Power Electronics',
      'Diagnostic Tools',
      'Cabin Accessories',
    ],
  },
  {
    name: 'EV Infrastructure & Energy',
    slug: 'ev-energy',
    type: CategoryType.EV_INFRASTRUCTURE_ENERGY,
    subcategories: [
      'Home Chargers',
      'Commercial Chargers',
      'Fleet Charging Systems',
      'DC Fast Chargers',
      'Solar EV Packages',
      'Battery Storage',
      'Smart Charging Systems',
      'Energy Management',
    ],
  },
];
