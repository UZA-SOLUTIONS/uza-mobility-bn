-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('INDIVIDUAL', 'BUSINESS', 'FLEET_OPERATOR', 'TAXI_ASSOCIATION', 'NGO', 'GOVERNMENT', 'SCHOOL', 'HOTEL', 'LOGISTICS_COMPANY');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('UZA_RWANDA_STOCK', 'UZA_CHINA_SOURCING', 'LOCAL_SELLER', 'INTERNATIONAL_SELLER');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('PASSENGER_EV', 'TWO_THREE_WHEEL', 'COMMERCIAL_EV', 'EV_PARTS_ACCESSORIES', 'EV_INFRASTRUCTURE_ENERGY');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'SOLD', 'RESERVED', 'SUSPENDED', 'REJECTED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PowertrainType" AS ENUM ('BEV', 'PHEV', 'HEV', 'EREV');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('SEDAN', 'SUV', 'HATCHBACK', 'CROSSOVER', 'COUPE', 'MPV', 'PICKUP_TRUCK', 'WAGON', 'MINIVAN', 'BUS', 'MINIBUS', 'VAN', 'CARGO_VAN', 'TRUCK', 'LIGHT_TRUCK', 'HEAVY_DUTY_TRUCK', 'UTILITY_VEHICLE', 'DELIVERY_VEHICLE', 'FORKLIFT', 'INDUSTRIAL', 'SHUTTLE', 'MOTORCYCLE', 'SCOOTER', 'BICYCLE', 'TRICYCLE', 'CARGO_BIKE');

-- CreateEnum
CREATE TYPE "ConditionLevel" AS ENUM ('NEW', 'EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "SteeringPosition" AS ENUM ('LEFT_HAND_DRIVE', 'RIGHT_HAND_DRIVE');

-- CreateEnum
CREATE TYPE "DrivetrainType" AS ENUM ('FWD', 'RWD', 'AWD', 'FOUR_WD');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('BASIC_LISTED', 'UZA_REVIEWED', 'UZA_VERIFIED', 'UZA_INSPECTED', 'BATTERY_VERIFIED', 'PREMIUM_VERIFIED');

-- CreateEnum
CREATE TYPE "UseCase" AS ENUM ('FAMILY', 'TAXI', 'DELIVERY', 'CORPORATE', 'FLEET', 'SCHOOL', 'HOTEL', 'LOGISTICS', 'INDUSTRIAL', 'GOVERNMENT', 'AGRICULTURE', 'WAREHOUSE', 'PERSONAL_MOBILITY', 'COURIER', 'CAMPUS', 'LAST_MILE');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PROFORMA', 'DEPOSIT', 'BALANCE', 'FINAL', 'FLEET', 'PARTS', 'CHARGING_EQUIPMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'UNDER_VERIFICATION', 'PAYMENT_CONFIRMED', 'PARTIALLY_PAID', 'FULLY_PAID', 'EXPIRED', 'REJECTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUBMITTED', 'UNDER_VERIFICATION', 'CONFIRMED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('INVOICE_ISSUED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'VEHICLE_RESERVED', 'PROCESSING', 'IN_TRANSIT', 'ARRIVED', 'CLEARANCE', 'READY_FOR_HANDOVER', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancingStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SENT_TO_BANK', 'BANK_APPROVED', 'BANK_REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FleetRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartCondition" AS ENUM ('NEW', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "ChargingProductType" AS ENUM ('HOME_CHARGER', 'COMMERCIAL_CHARGER', 'FLEET_CHARGING_SYSTEM', 'PUBLIC_CHARGING_STATION', 'DC_FAST_CHARGER', 'AC_CHARGER', 'CHARGING_ACCESSORY', 'SOLAR_EV_PACKAGE', 'BATTERY_STORAGE', 'SMART_CHARGING', 'ENERGY_MANAGEMENT', 'SITE_EQUIPMENT');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('FEATURED_LISTING', 'HOMEPAGE_BANNER', 'CATEGORY_SPONSORSHIP', 'SPONSORED_SUPPLIER', 'BANK_PARTNER_BANNER', 'CHARGING_PARTNER_BANNER', 'DEAL_OF_WEEK', 'NEW_ARRIVAL_HIGHLIGHT', 'DISCOUNT_CAMPAIGN', 'FLEET_DISCOUNT', 'TAXI_ASSOCIATION_CAMPAIGN', 'SEASONAL_PROMOTION', 'REFERRAL_PROMOTION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVOICE_ISSUED', 'PAYMENT_CONFIRMED', 'PAYMENT_REJECTED', 'ORDER_STATUS_UPDATED', 'LISTING_APPROVED', 'LISTING_REJECTED', 'FINANCING_UPDATE', 'FLEET_REQUEST_UPDATE', 'SYSTEM_ALERT');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "profilePhoto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buyerType" "BuyerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "organizationName" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'RW',
    "nationalId" TEXT,
    "passportNumber" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerType" "SellerType" NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'PENDING',
    "businessName" TEXT NOT NULL,
    "businessRegNumber" TEXT,
    "taxId" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_subscriptions" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "listingLimit" INTEGER NOT NULL DEFAULT 5,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,
    "listingTitle" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "sellerType" "SellerType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "manufacturingYear" INTEGER NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "condition" "ConditionLevel" NOT NULL DEFAULT 'NEW',
    "bodyType" "BodyType",
    "powertrainType" "PowertrainType" NOT NULL DEFAULT 'BEV',
    "color" TEXT,
    "seats" INTEGER,
    "steeringPosition" "SteeringPosition",
    "drivetrain" "DrivetrainType",
    "mileageKm" DOUBLE PRECISION,
    "hasWarranty" BOOLEAN NOT NULL DEFAULT false,
    "warrantyDetails" TEXT,
    "hasAccidentHistory" BOOLEAN NOT NULL DEFAULT false,
    "ownershipCount" INTEGER,
    "registrationStatus" TEXT,
    "vehicleLocation" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'RW',
    "availabilityStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "deliveryEstimateDays" INTEGER,
    "videoUrl" TEXT,
    "description" TEXT,
    "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'BASIC_LISTED',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isHotDeal" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "adminNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ev_specs" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "batteryCapacityKwh" DOUBLE PRECISION,
    "batteryHealthPercent" DOUBLE PRECISION,
    "batteryHealthReport" BOOLEAN NOT NULL DEFAULT false,
    "rangeKm" DOUBLE PRECISION,
    "chargingType" TEXT,
    "fastChargingSupported" BOOLEAN NOT NULL DEFAULT false,
    "chargingTimeHours" DOUBLE PRECISION,
    "motorPowerKw" DOUBLE PRECISION,
    "topSpeedKmh" DOUBLE PRECISION,
    "payloadCapacityKg" DOUBLE PRECISION,
    "grossVehicleWeightKg" DOUBLE PRECISION,
    "seatingCapacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ev_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_photos" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_use_cases" (
    "listingId" TEXT NOT NULL,
    "useCase" "UseCase" NOT NULL,

    CONSTRAINT "listing_use_cases_pkey" PRIMARY KEY ("listingId","useCase")
);

-- CreateTable
CREATE TABLE "saved_listings" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "sellerType" "SellerType" NOT NULL,
    "originCountry" TEXT,
    "destinationCountry" TEXT,
    "shippingCostUsd" DOUBLE PRECISION,
    "localChargesUsd" DOUBLE PRECISION,
    "taxRatePercent" DOUBLE PRECISION,
    "insuranceRatePercent" DOUBLE PRECISION,
    "storagePerDayUsd" DOUBLE PRECISION,
    "clearingFeeUsd" DOUBLE PRECISION,
    "platformMarginPercent" DOUBLE PRECISION,
    "commissionRate" DOUBLE PRECISION,
    "exchangeRateRwf" DOUBLE PRECISION,
    "deliveryDaysMin" INTEGER,
    "deliveryDaysMax" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_pricing" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "basePriceUsd" DOUBLE PRECISION,
    "fobPriceUsd" DOUBLE PRECISION,
    "sellerDesiredPayoutUsd" DOUBLE PRECISION,
    "shippingCostUsd" DOUBLE PRECISION,
    "localChargesUsd" DOUBLE PRECISION,
    "taxesEstimateUsd" DOUBLE PRECISION,
    "insuranceUsd" DOUBLE PRECISION,
    "storageUsd" DOUBLE PRECISION,
    "clearingFeeUsd" DOUBLE PRECISION,
    "landingCostUsd" DOUBLE PRECISION,
    "marginUsd" DOUBLE PRECISION,
    "commissionUsd" DOUBLE PRECISION,
    "discountUsd" DOUBLE PRECISION,
    "finalPriceUsd" DOUBLE PRECISION NOT NULL,
    "finalPriceRwf" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceValidUntil" TIMESTAMP(3),
    "priceNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_reports" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'BASIC_LISTED',
    "inspectionStatus" TEXT,
    "batteryReportStatus" TEXT,
    "documentStatus" TEXT,
    "inspectorName" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "reportUrl" TEXT,
    "batteryReportUrl" TEXT,
    "riskNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'PROFORMA',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "buyerAddress" TEXT,
    "buyerType" TEXT,
    "vehicleBrand" TEXT,
    "vehicleModel" TEXT,
    "vehicleTrim" TEXT,
    "vehicleYear" INTEGER,
    "vehicleCondition" TEXT,
    "vehicleLocation" TEXT,
    "sellerType" "SellerType",
    "verificationLevel" TEXT,
    "basePriceUsd" DOUBLE PRECISION,
    "fobPriceUsd" DOUBLE PRECISION,
    "shippingCostUsd" DOUBLE PRECISION,
    "localChargesUsd" DOUBLE PRECISION,
    "taxesUsd" DOUBLE PRECISION,
    "insuranceUsd" DOUBLE PRECISION,
    "clearingFeeUsd" DOUBLE PRECISION,
    "landingCostUsd" DOUBLE PRECISION,
    "marginUsd" DOUBLE PRECISION,
    "discountUsd" DOUBLE PRECISION,
    "totalAmountUsd" DOUBLE PRECISION NOT NULL,
    "totalAmountRwf" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "beneficiaryName" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "paymentDeadline" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "deliveryEstimate" TEXT,
    "pdfUrl" TEXT,
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bankName" TEXT,
    "transferReference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "senderName" TEXT,
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "bankStatementRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'INVOICE_ISSUED',
    "sellerType" "SellerType" NOT NULL,
    "deliveryAddress" TEXT,
    "deliveryCity" TEXT,
    "deliveryCountry" TEXT NOT NULL DEFAULT 'RW',
    "estimatedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "handoverNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_tracking_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "performedBy" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financing_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "listingId" TEXT,
    "status" "FinancingStatus" NOT NULL DEFAULT 'SUBMITTED',
    "buyerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "buyerType" "BuyerType",
    "employmentStatus" TEXT,
    "organizationName" TEXT,
    "preferredDepositUsd" DOUBLE PRECISION,
    "preferredBankName" TEXT,
    "notes" TEXT,
    "assignedBankId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_members" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "userId" TEXT,
    "memberName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "association_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "associationId" TEXT,
    "status" "FleetRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "organizationName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "buyerType" "BuyerType" NOT NULL,
    "vehicleCategoryId" TEXT,
    "vehicleSubcategoryId" TEXT,
    "quantity" INTEGER NOT NULL,
    "useCase" "UseCase",
    "preferredDeliveryTimeline" TEXT,
    "budgetRangeMin" DOUBLE PRECISION,
    "budgetRangeMax" DOUBLE PRECISION,
    "financingRequested" BOOLEAN NOT NULL DEFAULT false,
    "chargingSupportRequested" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "adminNotes" TEXT,
    "quotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "compatibleBrands" TEXT[],
    "compatibleModels" TEXT[],
    "condition" "PartCondition" NOT NULL DEFAULT 'NEW',
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "deliveryEstimate" TEXT,
    "hasWarranty" BOOLEAN NOT NULL DEFAULT false,
    "warrantyDetails" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_photos" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "part_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "productType" "ChargingProductType" NOT NULL,
    "brand" TEXT,
    "powerKw" DOUBLE PRECISION,
    "voltage" TEXT,
    "connectorTypes" TEXT[],
    "solarIncluded" BOOLEAN NOT NULL DEFAULT false,
    "priceUsd" DOUBLE PRECISION,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_product_photos" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "charging_product_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "energy_requests" (
    "id" TEXT NOT NULL,
    "clientType" "BuyerType",
    "location" TEXT,
    "city" TEXT,
    "numberOfEvs" INTEGER,
    "chargerTypeNeeded" "ChargingProductType",
    "solarSupportNeeded" BOOLEAN NOT NULL DEFAULT false,
    "fleetUse" BOOLEAN NOT NULL DEFAULT false,
    "siteVisitRequested" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "chargingProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "energy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "sponsorName" TEXT,
    "discountAmountUsd" DOUBLE PRECISION,
    "discountPercent" DOUBLE PRECISION,
    "bannerImageUrl" TEXT,
    "bannerPlacement" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clickUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_promotions" (
    "listingId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_promotions_pkey" PRIMARY KEY ("listingId","promotionId")
);

-- CreateTable
CREATE TABLE "sustainability_metrics" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "orderId" TEXT,
    "vehicleType" TEXT,
    "buyerType" "BuyerType",
    "fleetClientName" TEXT,
    "country" TEXT,
    "estimatedFuelSavedL" DOUBLE PRECISION,
    "estimatedCo2AvoidedKg" DOUBLE PRECISION,
    "greenKmSupported" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sustainability_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_key" ON "permissions"("action");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_profiles_userId_key" ON "buyer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_userId_key" ON "sellers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscriptions_sellerId_key" ON "seller_subscriptions"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_slug_key" ON "subcategories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_categoryId_name_key" ON "subcategories"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "listings_slug_key" ON "listings"("slug");

-- CreateIndex
CREATE INDEX "listings_status_sellerType_idx" ON "listings"("status", "sellerType");

-- CreateIndex
CREATE INDEX "listings_brand_model_idx" ON "listings"("brand", "model");

-- CreateIndex
CREATE INDEX "listings_country_city_idx" ON "listings"("country", "city");

-- CreateIndex
CREATE UNIQUE INDEX "ev_specs_listingId_key" ON "ev_specs"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_pricing_listingId_key" ON "listing_pricing"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_reports_listingId_key" ON "verification_reports"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paymentReference_key" ON "invoices"("paymentReference");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_userId_idx" ON "invoices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoiceId_key" ON "orders"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "financing_requests_invoiceId_key" ON "financing_requests"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "parts_slug_key" ON "parts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "charging_products_slug_key" ON "charging_products"("slug");

-- CreateIndex
CREATE INDEX "activity_logs_entity_entityId_idx" ON "activity_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ev_specs" ADD CONSTRAINT "ev_specs_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_use_cases" ADD CONSTRAINT "listing_use_cases_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_pricing" ADD CONSTRAINT "listing_pricing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_tracking_events" ADD CONSTRAINT "order_tracking_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_requests" ADD CONSTRAINT "financing_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_requests" ADD CONSTRAINT "financing_requests_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_requests" ADD CONSTRAINT "financing_requests_assignedBankId_fkey" FOREIGN KEY ("assignedBankId") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_members" ADD CONSTRAINT "association_members_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_requests" ADD CONSTRAINT "fleet_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_requests" ADD CONSTRAINT "fleet_requests_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_photos" ADD CONSTRAINT "part_photos_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_product_photos" ADD CONSTRAINT "charging_product_photos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "charging_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_requests" ADD CONSTRAINT "energy_requests_chargingProductId_fkey" FOREIGN KEY ("chargingProductId") REFERENCES "charging_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_promotions" ADD CONSTRAINT "listing_promotions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sustainability_metrics" ADD CONSTRAINT "sustainability_metrics_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
