-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXTENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "PlacementDaySource" AS ENUM ('APP', 'CHARGING', 'MANUAL');

-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('VEHICLE', 'SAFETY', 'LITERACY', 'BUSINESS');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'STOPPED');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('COMPREHENSION', 'ROAD_CRAFT', 'EV_CARE');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('TRIP_FARE', 'CASH_DEPOSIT', 'MOMO_DEPOSIT', 'COMMISSION', 'ENERGY', 'INSTALMENT_SWEEP', 'RESERVE_FUND', 'RESERVE_DRAW', 'RESERVE_RETURN', 'WITHDRAWAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReadinessPillar" AS ENUM ('OPERATING_CAPABILITY', 'PAYMENT_DISCIPLINE', 'COMPREHENSION', 'ASSET_STEWARDSHIP', 'IDENTITY_COMPLIANCE', 'SUPPORT_STRUCTURE');

-- CreateEnum
CREATE TYPE "ReadinessBand" AS ENUM ('NOT_YET_FUNDABLE', 'DEVELOPING', 'BANKABLE', 'STRONG');

-- CreateEnum
CREATE TYPE "DriverStage" AS ENUM ('CANDIDATE', 'IN_ACADEMY', 'CERTIFIED', 'POOL_AVAILABLE', 'FINANCING_SUBMITTED', 'FINANCING_APPROVED', 'IN_TRANSFER', 'OWNER_DRIVER', 'EXITED');

-- CreateEnum
CREATE TYPE "PoolReason" AS ENUM ('AWAITING_VEHICLE', 'BUILDING_EXPERIENCE', 'AWAITING_BANK', 'BY_CHOICE');

-- CreateEnum
CREATE TYPE "VehicleOwnership" AS ENUM ('UZA_FLEET', 'CLIENT_MANAGED', 'DRIVER_OWNED');

-- CreateEnum
CREATE TYPE "ManagedVehicleStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'IN_GARAGE', 'IDLE', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "FeeBasis" AS ENUM ('PERCENT_OF_GROSS', 'FIXED_DAILY', 'FIXED_MONTHLY');

-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('PLACEMENT', 'MANAGED_FLEET', 'OWNER');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentBasis" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "DriverPayBasis" AS ENUM ('SHARE_OF_NET', 'FIXED_DAILY', 'FIXED_MONTHLY');

-- CreateEnum
CREATE TYPE "DriverRequestStatus" AS ENUM ('OPEN', 'MATCHED', 'FULFILLED', 'CANCELLED', 'UNFULFILLED');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('NEW', 'ACTIVE', 'TRUSTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BenefitKind" AS ENUM ('CHARGING_DISCOUNT', 'PARTS_DISCOUNT', 'SERVICE_DISCOUNT', 'INSURANCE_RATE', 'FEE_WAIVER', 'PRIORITY_ACCESS');

-- CreateEnum
CREATE TYPE "BenefitFundedBy" AS ENUM ('UZA', 'PARTNER', 'SHARED');

-- CreateEnum
CREATE TYPE "SupplierKind" AS ENUM ('MANUFACTURER', 'EXPORTER', 'TRADER', 'AUCTION');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SettlementRoute" AS ENUM ('PREPAID', 'ROUTE_B_ON_LANDING', 'ROUTE_A_DEFERRED');

-- CreateEnum
CREATE TYPE "SupplyOrderStatus" AS ENUM ('DRAFT', 'EVIDENCE_REVIEW', 'ACCEPTED', 'ADDENDUM_SIGNED', 'DEPOSIT_PAID', 'IN_PRODUCTION', 'SHIPPED', 'AT_PORT', 'LANDED', 'CLEARED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplyPaymentStage" AS ENUM ('DEPOSIT', 'ARRIVAL', 'BALANCE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PartyScope" AS ENUM ('INTERNAL', 'SUPPLIER', 'LENDER', 'CUSTOMER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "BatteryModel" AS ENUM ('financed', 'subscription', 'undecided');

-- CreateEnum
CREATE TYPE "ConsignmentStatus" AS ENUM ('planned', 'loaded', 'in_transit', 'arrived_port', 'cleared', 'at_yard', 'distributed');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('in_consignment', 'at_yard', 'allocated', 'registered', 'delivered', 'returned');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('queued', 'promised', 'confirmed', 'declined', 'fulfilled', 'lapsed');

-- CreateEnum
CREATE TYPE "BankFileStatus" AS ENUM ('building', 'ready', 'submitted', 'queried', 'approved', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('generated', 'uploaded', 'external');

-- CreateTable
CREATE TABLE "placement_programmes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedOn" DATE NOT NULL,
    "endedOn" DATE,
    "targetDays" INTEGER NOT NULL DEFAULT 90,
    "endReason" TEXT,
    "daysOperated" INTEGER NOT NULL DEFAULT 0,
    "grossRwfTotal" BIGINT NOT NULL DEFAULT 0,
    "netRwfTotal" BIGINT NOT NULL DEFAULT 0,
    "avgNetPerDayRwf" BIGINT NOT NULL DEFAULT 0,
    "utilisationPct" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_days" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" "PlacementDaySource" NOT NULL DEFAULT 'APP',
    "operated" BOOLEAN NOT NULL DEFAULT true,
    "offReason" TEXT,
    "tripsCount" INTEGER NOT NULL DEFAULT 0,
    "kmDriven" DOUBLE PRECISION,
    "kwhCharged" DOUBLE PRECISION,
    "grossRwf" BIGINT NOT NULL DEFAULT 0,
    "commissionRwf" BIGINT NOT NULL DEFAULT 0,
    "energyRwf" BIGINT NOT NULL DEFAULT 0,
    "runningCostRwf" BIGINT NOT NULL DEFAULT 0,
    "netRwf" BIGINT NOT NULL DEFAULT 0,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_modules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ModuleKind" NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "sequence" INTEGER NOT NULL,
    "summary" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deliveredByPartner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academy_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohorts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partner" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrolments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,

    CONSTRAINT "enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_attendance" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "attendedAt" TIMESTAMP(3) NOT NULL,
    "assessorId" TEXT,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "module_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "scorePct" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'rw',
    "oral" BOOLEAN NOT NULL DEFAULT true,
    "recordingUrl" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "assessorId" TEXT,
    "retestOfId" TEXT,
    "dueAgainOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answers" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionCode" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "balanceRwf" BIGINT NOT NULL DEFAULT 0,
    "reserveBalanceRwf" BIGINT NOT NULL DEFAULT 0,
    "reserveTargetDays" INTEGER NOT NULL DEFAULT 15,
    "reserveRatePct" INTEGER NOT NULL DEFAULT 8,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "amountRwf" BIGINT NOT NULL,
    "balanceAfterRwf" BIGINT NOT NULL,
    "reserveBalanceAfterRwf" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "externalRef" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sweep_mandates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'PENDING',
    "bankName" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumberMasked" TEXT NOT NULL,
    "standingOrderRef" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sweep_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_splits" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "splitDate" DATE NOT NULL,
    "grossRwf" BIGINT NOT NULL DEFAULT 0,
    "commissionRwf" BIGINT NOT NULL DEFAULT 0,
    "energyRwf" BIGINT NOT NULL DEFAULT 0,
    "runningCostRwf" BIGINT NOT NULL DEFAULT 0,
    "netRwf" BIGINT NOT NULL DEFAULT 0,
    "instalmentRwf" BIGINT NOT NULL DEFAULT 0,
    "reserveRwf" BIGINT NOT NULL DEFAULT 0,
    "reserveDrawnRwf" BIGINT NOT NULL DEFAULT 0,
    "driverRwf" BIGINT NOT NULL DEFAULT 0,
    "sweptAt" TIMESTAMP(3),
    "sweepRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "band" "ReadinessBand" NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'v1',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedBy" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "submittedWithFinancingRequestId" TEXT,

    CONSTRAINT "readiness_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_pillar_scores" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "pillar" "ReadinessPillar" NOT NULL,
    "points" INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "inputs" JSONB NOT NULL,

    CONSTRAINT "readiness_pillar_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "satisfiedAt" TIMESTAMP(3),
    "sourceSystem" TEXT,
    "sourceRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "DriverStage" NOT NULL DEFAULT 'CANDIDATE',
    "poolReason" "PoolReason",
    "availableFrom" DATE,
    "homeDistrict" TEXT,
    "licenceClass" TEXT,
    "yearsDriving" INTEGER,
    "serviceScore" INTEGER,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "modulesPassed" INTEGER NOT NULL,
    "comprehensionPct" INTEGER NOT NULL,
    "roadCraftPassed" BOOLEAN NOT NULL DEFAULT false,
    "evCarePassed" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_vehicles" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "listingId" TEXT,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "ownership" "VehicleOwnership" NOT NULL,
    "status" "ManagedVehicleStatus" NOT NULL DEFAULT 'ONBOARDING',
    "onboardedAt" TIMESTAMP(3),
    "offboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_agreements" (
    "id" TEXT NOT NULL,
    "managedVehicleId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "feeBasis" "FeeBasis" NOT NULL,
    "feePercent" INTEGER,
    "feeFixedRwf" BIGINT,
    "driverSupplied" BOOLEAN NOT NULL DEFAULT true,
    "insuranceBy" TEXT NOT NULL,
    "maintenanceBy" TEXT NOT NULL,
    "minGuaranteeRwf" BIGINT,
    "guaranteeApprovalRef" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "signedDocRef" TEXT NOT NULL,
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "management_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managedVehicleId" TEXT NOT NULL,
    "kind" "AssignmentKind" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "basis" "AssignmentBasis" NOT NULL DEFAULT 'MONTHLY',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "driverPayBasis" "DriverPayBasis" NOT NULL,
    "driverPayRwf" BIGINT,
    "driverSharePct" INTEGER,
    "engagement" TEXT NOT NULL,
    "requestedById" TEXT,
    "endedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_requests" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "managedVehicleId" TEXT,
    "basis" "AssignmentBasis" NOT NULL,
    "neededFrom" DATE NOT NULL,
    "neededTo" DATE,
    "district" TEXT,
    "status" "DriverRequestStatus" NOT NULL DEFAULT 'OPEN',
    "matchedAssignmentId" TEXT,
    "unfulfilledReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_days" (
    "id" TEXT NOT NULL,
    "managedVehicleId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "assignmentId" TEXT,
    "driverUserId" TEXT,
    "grossRwf" BIGINT NOT NULL DEFAULT 0,
    "energyRwf" BIGINT NOT NULL DEFAULT 0,
    "commissionRwf" BIGINT NOT NULL DEFAULT 0,
    "driverPayRwf" BIGINT NOT NULL DEFAULT 0,
    "maintenanceRwf" BIGINT NOT NULL DEFAULT 0,
    "managementFeeRwf" BIGINT NOT NULL DEFAULT 0,
    "ownerNetRwf" BIGINT NOT NULL DEFAULT 0,
    "operated" BOOLEAN NOT NULL DEFAULT true,
    "idleReason" TEXT,
    "kmDriven" DOUBLE PRECISION,
    "tripsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL DEFAULT 'NEW',
    "tierSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasonCode" TEXT NOT NULL,
    "reasonNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_benefits" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerUserId" TEXT,
    "kind" "BenefitKind" NOT NULL,
    "minTier" "MembershipTier" NOT NULL DEFAULT 'ACTIVE',
    "discountPct" INTEGER,
    "discountFixedRwf" BIGINT,
    "maxPerDayRwf" BIGINT,
    "maxPerMonthRwf" BIGINT,
    "fundedBy" "BenefitFundedBy" NOT NULL,
    "uzaSharePct" INTEGER,
    "termsRef" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_redemptions" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uzaId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "grossRwf" BIGINT NOT NULL,
    "discountRwf" BIGINT NOT NULL,
    "fundedByUzaRwf" BIGINT NOT NULL DEFAULT 0,
    "fundedByPartnerRwf" BIGINT NOT NULL DEFAULT 0,
    "externalRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "kind" "SupplierKind" NOT NULL,
    "status" "SupplierStatus" NOT NULL DEFAULT 'PROSPECT',
    "country" TEXT NOT NULL,
    "registrationNo" TEXT,
    "addressLine" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'RWF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bank_accounts" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branch" TEXT,
    "accountNumberMasked" TEXT NOT NULL,
    "swift" TEXT,
    "currency" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verifiedMethod" TEXT,
    "approvedById" TEXT,
    "secondApprovedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_agreements" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "signedOn" DATE,
    "expiresOn" DATE,
    "priceBasisDefault" TEXT,
    "depositPct" INTEGER,
    "arrivalPct" INTEGER,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "docRef" TEXT,
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_orders" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "agreementId" TEXT,
    "route" "SettlementRoute" NOT NULL,
    "priceBasis" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "arrivalDefinition" TEXT NOT NULL,
    "depositPct" INTEGER NOT NULL,
    "arrivalPct" INTEGER NOT NULL,
    "orderValueMinor" BIGINT NOT NULL,
    "status" "SupplyOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "signedOn" DATE,
    "depositPaidOn" DATE,
    "shippedOn" DATE,
    "vesselName" TEXT,
    "voyageNo" TEXT,
    "blNumber" TEXT,
    "etaOn" DATE,
    "arrivedOn" DATE,
    "landedOn" DATE,
    "settledOn" DATE,
    "cancelledOn" TIMESTAMP(3),
    "cancelReason" TEXT,
    "depositRecoveredMinor" BIGINT,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_order_vehicles" (
    "id" TEXT NOT NULL,
    "supplyOrderId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "colour" TEXT,
    "mileageKm" INTEGER,
    "batterySohPct" INTEGER,
    "priceMinor" BIGINT NOT NULL,
    "evidencePackRef" TEXT,
    "evidenceAcceptedAt" TIMESTAMP(3),
    "evidenceAcceptedBy" TEXT,
    "evidenceRejectedReason" TEXT,
    "balanceDueMinor" BIGINT,
    "balancePaidOn" DATE,
    "securityReleasedOn" DATE,
    "listingId" TEXT,
    "managedVehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_order_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_payments" (
    "id" TEXT NOT NULL,
    "supplyOrderId" TEXT NOT NULL,
    "stage" "SupplyPaymentStage" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "proofRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counterparty_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "PartyScope" NOT NULL,
    "supplierId" TEXT,
    "bankId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "counterparty_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_classes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "earnsDaily" BOOLEAN NOT NULL DEFAULT true,
    "unitsPerContainer" INTEGER,
    "batterySeparable" BOOLEAN,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_products" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "lenderName" TEXT,
    "contributionBps" INTEGER NOT NULL,
    "contributionBpsHigh" INTEGER,
    "bandThresholdRwf" BIGINT,
    "tenorMonths" INTEGER[],
    "insuranceBps" INTEGER NOT NULL,
    "insuranceCapitalisable" BOOLEAN NOT NULL DEFAULT true,
    "collateralBps" INTEGER NOT NULL DEFAULT 300,
    "minContributionRwf" BIGINT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_battery_terms" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "model" "BatteryModel" NOT NULL DEFAULT 'undecided',
    "monthlyFeeRwf" BIGINT,
    "swapNetwork" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_battery_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freight_evidence" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "uzaId" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "contractValueRwf" BIGINT NOT NULL,
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3),
    "documentUrl" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freight_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignments" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "status" "ConsignmentStatus" NOT NULL DEFAULT 'planned',
    "supplyOrderRef" TEXT,
    "containerNo" TEXT,
    "vesselOrTruck" TEXT,
    "originPort" TEXT,
    "destinationPort" TEXT,
    "etdPlanned" TIMESTAMP(3),
    "etaPlanned" TIMESTAMP(3),
    "etdActual" TIMESTAMP(3),
    "etaActual" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "declaredWeightKg" INTEGER,
    "declaredCbm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignment_units" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "consignmentId" TEXT NOT NULL,
    "classCode" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "colour" TEXT,
    "batteryNo" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'in_consignment',
    "landedCostRwf" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignment_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_queue" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "uzaId" TEXT NOT NULL,
    "classCode" TEXT NOT NULL,
    "readyAt" TIMESTAMP(3) NOT NULL,
    "preferredMake" TEXT,
    "preferredModel" TEXT,
    "priorityReason" TEXT,
    "prioritisedById" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'promised',
    "promisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "outcomeNote" TEXT,
    "decidedById" TEXT,
    "activeHoldUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_files" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "status" "BankFileStatus" NOT NULL DEFAULT 'building',
    "uzaId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "productRef" TEXT NOT NULL,
    "allocationRef" TEXT,
    "pricePaidRwf" BIGINT,
    "contributionRwf" BIGINT,
    "insuranceRwf" BIGINT,
    "financedAmountRwf" BIGINT,
    "tenorMonths" INTEGER,
    "readinessScoreRef" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "lenderRef" TEXT,
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_file_items" (
    "id" TEXT NOT NULL,
    "bankFileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" "ItemSource" NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "documentUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "queryNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_file_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_file_events" (
    "id" TEXT NOT NULL,
    "bankFileId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "bank_file_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_commitments" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "classCode" TEXT NOT NULL,
    "unitsCommitted" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "documented" BOOLEAN NOT NULL DEFAULT false,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lender_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placement_programmes_userId_status_idx" ON "placement_programmes"("userId", "status");

-- CreateIndex
CREATE INDEX "placement_days_day_idx" ON "placement_days"("day");

-- CreateIndex
CREATE INDEX "placement_days_placementId_operated_idx" ON "placement_days"("placementId", "operated");

-- CreateIndex
CREATE UNIQUE INDEX "placement_days_placementId_day_key" ON "placement_days"("placementId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "academy_modules_code_key" ON "academy_modules"("code");

-- CreateIndex
CREATE INDEX "academy_modules_kind_sequence_idx" ON "academy_modules"("kind", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "cohorts_code_key" ON "cohorts"("code");

-- CreateIndex
CREATE INDEX "enrolments_cohortId_status_idx" ON "enrolments"("cohortId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrolments_userId_cohortId_key" ON "enrolments"("userId", "cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "module_attendance_enrolmentId_moduleId_key" ON "module_attendance"("enrolmentId", "moduleId");

-- CreateIndex
CREATE INDEX "assessments_enrolmentId_kind_assessedAt_idx" ON "assessments"("enrolmentId", "kind", "assessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answers_assessmentId_questionCode_key" ON "assessment_answers"("assessmentId", "questionCode");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_idempotencyKey_key" ON "ledger_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ledger_entries_walletId_occurredAt_idx" ON "ledger_entries"("walletId", "occurredAt");

-- CreateIndex
CREATE INDEX "ledger_entries_reason_occurredAt_idx" ON "ledger_entries"("reason", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "sweep_mandates_userId_key" ON "sweep_mandates"("userId");

-- CreateIndex
CREATE INDEX "sweep_mandates_status_idx" ON "sweep_mandates"("status");

-- CreateIndex
CREATE INDEX "daily_splits_splitDate_idx" ON "daily_splits"("splitDate");

-- CreateIndex
CREATE INDEX "daily_splits_walletId_sweptAt_idx" ON "daily_splits"("walletId", "sweptAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_splits_walletId_splitDate_key" ON "daily_splits"("walletId", "splitDate");

-- CreateIndex
CREATE INDEX "readiness_scores_userId_isCurrent_idx" ON "readiness_scores"("userId", "isCurrent");

-- CreateIndex
CREATE INDEX "readiness_scores_userId_computedAt_idx" ON "readiness_scores"("userId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "readiness_pillar_scores_scoreId_pillar_key" ON "readiness_pillar_scores"("scoreId", "pillar");

-- CreateIndex
CREATE INDEX "evidence_items_userId_satisfiedAt_idx" ON "evidence_items"("userId", "satisfiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_items_userId_code_key" ON "evidence_items"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_userId_key" ON "driver_profiles"("userId");

-- CreateIndex
CREATE INDEX "driver_profiles_stage_poolReason_idx" ON "driver_profiles"("stage", "poolReason");

-- CreateIndex
CREATE INDEX "driver_profiles_stage_availableFrom_idx" ON "driver_profiles"("stage", "availableFrom");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE INDEX "certificates_userId_issuedAt_idx" ON "certificates"("userId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "managed_vehicles_plate_key" ON "managed_vehicles"("plate");

-- CreateIndex
CREATE INDEX "managed_vehicles_ownerUserId_status_idx" ON "managed_vehicles"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "managed_vehicles_status_idx" ON "managed_vehicles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "management_agreements_managedVehicleId_key" ON "management_agreements"("managedVehicleId");

-- CreateIndex
CREATE INDEX "driver_assignments_managedVehicleId_status_idx" ON "driver_assignments"("managedVehicleId", "status");

-- CreateIndex
CREATE INDEX "driver_assignments_userId_status_idx" ON "driver_assignments"("userId", "status");

-- CreateIndex
CREATE INDEX "driver_assignments_status_startsOn_idx" ON "driver_assignments"("status", "startsOn");

-- CreateIndex
CREATE INDEX "driver_requests_status_neededFrom_idx" ON "driver_requests"("status", "neededFrom");

-- CreateIndex
CREATE INDEX "vehicle_days_day_idx" ON "vehicle_days"("day");

-- CreateIndex
CREATE INDEX "vehicle_days_managedVehicleId_operated_idx" ON "vehicle_days"("managedVehicleId", "operated");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_days_managedVehicleId_day_key" ON "vehicle_days"("managedVehicleId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_key" ON "memberships"("userId");

-- CreateIndex
CREATE INDEX "memberships_tier_idx" ON "memberships"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "partner_benefits_code_key" ON "partner_benefits"("code");

-- CreateIndex
CREATE INDEX "partner_benefits_isActive_kind_idx" ON "partner_benefits"("isActive", "kind");

-- CreateIndex
CREATE INDEX "partner_benefits_partnerName_idx" ON "partner_benefits"("partnerName");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_redemptions_idempotencyKey_key" ON "benefit_redemptions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "benefit_redemptions_userId_occurredAt_idx" ON "benefit_redemptions"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "benefit_redemptions_benefitId_occurredAt_idx" ON "benefit_redemptions"("benefitId", "occurredAt");

-- CreateIndex
CREATE INDEX "benefit_redemptions_settledAt_idx" ON "benefit_redemptions"("settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_status_kind_idx" ON "suppliers"("status", "kind");

-- CreateIndex
CREATE INDEX "supplier_bank_accounts_supplierId_isActive_idx" ON "supplier_bank_accounts"("supplierId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "supply_agreements_ref_key" ON "supply_agreements"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "supply_orders_ref_key" ON "supply_orders"("ref");

-- CreateIndex
CREATE INDEX "supply_orders_supplierId_status_idx" ON "supply_orders"("supplierId", "status");

-- CreateIndex
CREATE INDEX "supply_orders_status_etaOn_idx" ON "supply_orders"("status", "etaOn");

-- CreateIndex
CREATE INDEX "supply_orders_route_idx" ON "supply_orders"("route");

-- CreateIndex
CREATE UNIQUE INDEX "supply_order_vehicles_vin_key" ON "supply_order_vehicles"("vin");

-- CreateIndex
CREATE INDEX "supply_order_vehicles_supplyOrderId_idx" ON "supply_order_vehicles"("supplyOrderId");

-- CreateIndex
CREATE INDEX "supply_order_vehicles_listingId_idx" ON "supply_order_vehicles"("listingId");

-- CreateIndex
CREATE INDEX "supply_order_vehicles_balancePaidOn_securityReleasedOn_idx" ON "supply_order_vehicles"("balancePaidOn", "securityReleasedOn");

-- CreateIndex
CREATE UNIQUE INDEX "supply_payments_idempotencyKey_key" ON "supply_payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "supply_payments_supplyOrderId_stage_idx" ON "supply_payments"("supplyOrderId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "counterparty_access_userId_key" ON "counterparty_access"("userId");

-- CreateIndex
CREATE INDEX "counterparty_access_scope_supplierId_idx" ON "counterparty_access"("scope", "supplierId");

-- CreateIndex
CREATE INDEX "counterparty_access_scope_bankId_idx" ON "counterparty_access"("scope", "bankId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_classes_code_key" ON "vehicle_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "finance_products_ref_key" ON "finance_products"("ref");

-- CreateIndex
CREATE INDEX "finance_products_classId_active_idx" ON "finance_products"("classId", "active");

-- CreateIndex
CREATE INDEX "finance_products_lenderName_idx" ON "finance_products"("lenderName");

-- CreateIndex
CREATE UNIQUE INDEX "product_battery_terms_productId_key" ON "product_battery_terms"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "freight_evidence_ref_key" ON "freight_evidence"("ref");

-- CreateIndex
CREATE INDEX "freight_evidence_uzaId_idx" ON "freight_evidence"("uzaId");

-- CreateIndex
CREATE INDEX "freight_evidence_counterparty_idx" ON "freight_evidence"("counterparty");

-- CreateIndex
CREATE UNIQUE INDEX "consignments_ref_key" ON "consignments"("ref");

-- CreateIndex
CREATE INDEX "consignments_status_idx" ON "consignments"("status");

-- CreateIndex
CREATE INDEX "consignments_etaPlanned_idx" ON "consignments"("etaPlanned");

-- CreateIndex
CREATE UNIQUE INDEX "consignment_units_ref_key" ON "consignment_units"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "consignment_units_identifier_key" ON "consignment_units"("identifier");

-- CreateIndex
CREATE INDEX "consignment_units_consignmentId_idx" ON "consignment_units"("consignmentId");

-- CreateIndex
CREATE INDEX "consignment_units_status_idx" ON "consignment_units"("status");

-- CreateIndex
CREATE INDEX "consignment_units_classCode_status_idx" ON "consignment_units"("classCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_queue_ref_key" ON "allocation_queue"("ref");

-- CreateIndex
CREATE INDEX "allocation_queue_classCode_readyAt_idx" ON "allocation_queue"("classCode", "readyAt");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_queue_uzaId_classCode_key" ON "allocation_queue"("uzaId", "classCode");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_ref_key" ON "allocations"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_activeHoldUnitId_key" ON "allocations"("activeHoldUnitId");

-- CreateIndex
CREATE INDEX "allocations_unitId_idx" ON "allocations"("unitId");

-- CreateIndex
CREATE INDEX "allocations_queueId_idx" ON "allocations"("queueId");

-- CreateIndex
CREATE INDEX "allocations_expiresAt_idx" ON "allocations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "bank_files_ref_key" ON "bank_files"("ref");

-- CreateIndex
CREATE INDEX "bank_files_status_idx" ON "bank_files"("status");

-- CreateIndex
CREATE INDEX "bank_files_uzaId_idx" ON "bank_files"("uzaId");

-- CreateIndex
CREATE INDEX "bank_files_lenderName_status_idx" ON "bank_files"("lenderName", "status");

-- CreateIndex
CREATE INDEX "bank_file_items_code_present_idx" ON "bank_file_items"("code", "present");

-- CreateIndex
CREATE UNIQUE INDEX "bank_file_items_bankFileId_code_key" ON "bank_file_items"("bankFileId", "code");

-- CreateIndex
CREATE INDEX "bank_file_events_bankFileId_at_idx" ON "bank_file_events"("bankFileId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "lender_commitments_ref_key" ON "lender_commitments"("ref");

-- CreateIndex
CREATE INDEX "lender_commitments_lenderName_classCode_idx" ON "lender_commitments"("lenderName", "classCode");

-- AddForeignKey
ALTER TABLE "placement_programmes" ADD CONSTRAINT "placement_programmes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_days" ADD CONSTRAINT "placement_days_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "placement_programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_attendance" ADD CONSTRAINT "module_attendance_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_attendance" ADD CONSTRAINT "module_attendance_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "academy_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "enrolments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sweep_mandates" ADD CONSTRAINT "sweep_mandates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_splits" ADD CONSTRAINT "daily_splits_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_scores" ADD CONSTRAINT "readiness_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_pillar_scores" ADD CONSTRAINT "readiness_pillar_scores_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "readiness_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_agreements" ADD CONSTRAINT "management_agreements_managedVehicleId_fkey" FOREIGN KEY ("managedVehicleId") REFERENCES "managed_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_managedVehicleId_fkey" FOREIGN KEY ("managedVehicleId") REFERENCES "managed_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_days" ADD CONSTRAINT "vehicle_days_managedVehicleId_fkey" FOREIGN KEY ("managedVehicleId") REFERENCES "managed_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_redemptions" ADD CONSTRAINT "benefit_redemptions_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "partner_benefits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_redemptions" ADD CONSTRAINT "benefit_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "memberships"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bank_accounts" ADD CONSTRAINT "supplier_bank_accounts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_agreements" ADD CONSTRAINT "supply_agreements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_orders" ADD CONSTRAINT "supply_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_orders" ADD CONSTRAINT "supply_orders_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "supply_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_order_vehicles" ADD CONSTRAINT "supply_order_vehicles_supplyOrderId_fkey" FOREIGN KEY ("supplyOrderId") REFERENCES "supply_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_payments" ADD CONSTRAINT "supply_payments_supplyOrderId_fkey" FOREIGN KEY ("supplyOrderId") REFERENCES "supply_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_payments" ADD CONSTRAINT "supply_payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "supplier_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_products" ADD CONSTRAINT "finance_products_classId_fkey" FOREIGN KEY ("classId") REFERENCES "vehicle_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_units" ADD CONSTRAINT "consignment_units_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "consignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "consignment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "allocation_queue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_file_items" ADD CONSTRAINT "bank_file_items_bankFileId_fkey" FOREIGN KEY ("bankFileId") REFERENCES "bank_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_file_events" ADD CONSTRAINT "bank_file_events_bankFileId_fkey" FOREIGN KEY ("bankFileId") REFERENCES "bank_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
