-- CreateEnum
CREATE TYPE "IntakeSource" AS ENUM ('LENDER_REFERRAL', 'UZA_RECRUITED', 'ASSOCIATION', 'WALK_IN', 'RETURNING');

-- CreateEnum
CREATE TYPE "JourneyStage" AS ENUM ('REGISTERED', 'SCREENING', 'ENROLLED', 'TRAINING_IN_PROGRESS', 'SAVINGS_RECORD_BUILDING', 'ASSESSMENT_SCHEDULED', 'ASSESSMENT_PASSED', 'REASSESSMENT_REQUIRED', 'CERTIFIED', 'READINESS_SCORE_PUBLISHED', 'PLACED_IN_DRIVERS_POOL', 'ADVISED_TO_BUILD_FURTHER', 'VEHICLE_SELECTED', 'APPLICATION_SUBMITTED', 'LENDER_DOCUMENTS_REQUESTED', 'LENDER_UNDER_REVIEW', 'LENDER_INTERVIEW_SCHEDULED', 'LENDER_APPROVED_IN_PRINCIPLE', 'LENDER_CONDITIONS_TO_SATISFY', 'LENDER_DECLINED', 'COLLATERAL_REQUESTED', 'COLLATERAL_POSTED', 'INSURANCE_QUOTE_REQUESTED', 'INSURANCE_QUOTED', 'INSURANCE_POLICY_ISSUED', 'VEHICLE_ORDERED', 'VEHICLE_IN_TRANSIT', 'VEHICLE_CUSTOMS', 'VEHICLE_REGISTERED', 'VEHICLE_DELIVERED', 'LOAN_DISBURSED', 'REPAYMENT_ACTIVE', 'PAYMENT_DUE_SOON', 'ARREARS', 'SUPPORT_REQUESTED', 'RESTRUCTURE_UNDER_DISCUSSION', 'COLLATERAL_TRANCHE_ELIGIBLE', 'COLLATERAL_RELEASED', 'LOAN_CLOSED', 'EXITED_PROGRAMME');

-- CreateEnum
CREATE TYPE "GapKind" AS ENUM ('CONTRIBUTION_SHORT', 'NO_BUSINESS_REGISTRATION', 'INSUFFICIENT_TRADING_HISTORY', 'NO_FLEET_APP', 'NO_BANK_FARE_SETTLEMENT', 'NO_GPS_TRACKER', 'NO_VERIFIABLE_INCOME', 'THIN_CREDIT_FILE', 'DOCUMENTS_INCOMPLETE', 'LICENCE_OR_PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED_BY_PROGRAMME', 'CLOSED_BY_CANDIDATE', 'WAIVED_BY_LENDER', 'NOT_CLOSEABLE');

-- AlterTable
ALTER TABLE "cohorts" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'rw',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "plannedWeeks" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "seatsForRecruits" INTEGER,
ADD COLUMN     "seatsForReferrals" INTEGER,
ADD COLUMN     "seatsPlanned" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'planned',
ADD COLUMN     "track" TEXT NOT NULL DEFAULT 'TUNGA_TAXI',
ADD COLUMN     "womenTargetPct" INTEGER;

-- CreateTable
CREATE TABLE "candidate_journeys" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "uzaId" TEXT NOT NULL,
    "stage" "JourneyStage" NOT NULL DEFAULT 'REGISTERED',
    "intakeSource" "IntakeSource" NOT NULL,
    "referredBy" TEXT,
    "referredOn" TIMESTAMP(3),
    "cohortId" TEXT,
    "outcomeReason" TEXT,
    "remediationPath" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "candidate_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_events" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromStage" "JourneyStage",
    "toStage" "JourneyStage" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,

    CONSTRAINT "journey_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_gaps" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "kind" "GapKind" NOT NULL,
    "status" "GapStatus" NOT NULL DEFAULT 'OPEN',
    "detail" TEXT,
    "shortfallRwf" BIGINT,
    "raisedBy" TEXT,
    "raisedByRole" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closureNote" TEXT,

    CONSTRAINT "eligibility_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenings" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "screenedBy" TEXT NOT NULL,
    "screenedByOrg" TEXT NOT NULL,
    "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fundableToday" BOOLEAN NOT NULL,
    "fundableInPrinciple" BOOLEAN NOT NULL DEFAULT true,
    "summary" TEXT,
    "previousScreeningId" TEXT,

    CONSTRAINT "screenings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_journeys_ref_key" ON "candidate_journeys"("ref");

-- CreateIndex
CREATE INDEX "candidate_journeys_stage_idx" ON "candidate_journeys"("stage");

-- CreateIndex
CREATE INDEX "candidate_journeys_intakeSource_stage_idx" ON "candidate_journeys"("intakeSource", "stage");

-- CreateIndex
CREATE INDEX "candidate_journeys_referredBy_idx" ON "candidate_journeys"("referredBy");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_journeys_uzaId_cohortId_key" ON "candidate_journeys"("uzaId", "cohortId");

-- CreateIndex
CREATE INDEX "journey_events_journeyId_at_idx" ON "journey_events"("journeyId", "at");

-- CreateIndex
CREATE INDEX "eligibility_gaps_status_idx" ON "eligibility_gaps"("status");

-- CreateIndex
CREATE INDEX "eligibility_gaps_kind_status_idx" ON "eligibility_gaps"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_gaps_journeyId_kind_key" ON "eligibility_gaps"("journeyId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "screenings_ref_key" ON "screenings"("ref");

-- CreateIndex
CREATE INDEX "screenings_journeyId_screenedAt_idx" ON "screenings"("journeyId", "screenedAt");

-- CreateIndex
CREATE INDEX "screenings_screenedByOrg_idx" ON "screenings"("screenedByOrg");

-- CreateIndex
CREATE INDEX "cohorts_track_status_idx" ON "cohorts"("track", "status");

-- AddForeignKey
ALTER TABLE "candidate_journeys" ADD CONSTRAINT "candidate_journeys_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "candidate_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_gaps" ADD CONSTRAINT "eligibility_gaps_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "candidate_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
