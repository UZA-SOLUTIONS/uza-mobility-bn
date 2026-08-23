/**
 * Open a candidate journey for everyone already in the programme, and record the screening
 * that put them there.
 *
 *   npx ts-node prisma/seed-tunga-journeys.ts
 *
 * Run after seed-tunga-candidates.ts. Idempotent on `[uzaId, cohortId]`.
 *
 * WHAT THIS DOES AND DOES NOT CLAIM
 *
 * The 42 people on the Unguka list were screened by the bank and set aside. That much is
 * fact, and it is recorded: a Screening row per person, `screenedByOrg = LOLC Unguka`,
 * `fundableToday = false`, `fundableInPrinciple = true`.
 *
 * What is NOT fact is which eligibility criteria each individual fails. The referral list
 * carries a name, a date, a vehicle preference, a stated contribution and a phone number —
 * nothing about business registration, trading history, fleet-app use or a GPS tracker. So
 * this seed opens ONLY the gaps the data actually supports:
 *
 *   · CONTRIBUTION_SHORT — where the stated contribution is below the threshold, with the
 *     shortfall computed from their own figure.
 *   · NO_VERIFIABLE_INCOME — for everyone, because the placement programme has not run and
 *     therefore no measured daily net exists for anyone on this list.
 *
 * The other gaps are left unopened rather than assumed. Inventing a NO_GPS_TRACKER row for
 * forty-two people nobody has asked would produce a confident report about a fact that was
 * never established, and the first time Unguka checked one it would discredit the rest.
 * Those rows get created at real screening, by whoever screens.
 */
import 'dotenv/config';
import { PrismaClient, Prisma, IntakeSource, GapKind } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * The contribution threshold used to compute a shortfall.
 *
 * [UNVERIFIED — needs check: Unguka's actual required contribution.] The nexus evidence base
 * is explicit that "10–30%" is unverified for Rwanda; the only published Rwandan figure is
 * Muganga SACCO at 10%, and BK's taxi terms are 5–10%. RWF 2,000,000 is used here as the
 * working figure from the founder's own account of the Unguka conversation, and every
 * shortfall computed from it inherits that uncertainty. Replace it the moment the term sheet
 * exists — the number is deliberately a constant so there is exactly one place to change.
 */
const REQUIRED_CONTRIBUTION_RWF = 2_000_000n;

const COHORT_CODE = 'TT-2026-01';

async function main() {
  // One mixed cohort. The Unguka referrals train alongside people UZA recruited, because a
  // cohort of one lender's rejects only ever proves UZA can fix that lender's rejects.
  const cohort = await prisma.cohort.upsert({
    where: { code: COHORT_CODE },
    create: {
      code: COHORT_CODE,
      name: 'Tunga Taxi — cohort 1 [proposed name, not confirmed]',
      partner: 'LOLC Unguka Finance',
      startsOn: new Date('2026-09-15'),
      track: 'TUNGA_TAXI',
      plannedWeeks: 10,
      language: 'rw',
      seatsPlanned: 25,
      seatsForReferrals: 15,
      seatsForRecruits: 10,
      womenTargetPct: 32, // 8 of 25 — the Phase 1 minimum, not a ceiling
      status: 'planned',
    },
    update: {},
  });

  const files = await prisma.bankFile.findMany({
    select: { uzaId: true, contributionRwf: true, createdAt: true },
    orderBy: { ref: 'asc' },
  });
  if (!files.length) {
    console.error('No bank files. Run seed-tunga-candidates.ts first.');
    process.exitCode = 1;
    return;
  }

  let journeys = 0;
  let screenings = 0;
  let gapRows = 0;
  let shortTotal = 0n;
  const shortCount: number[] = [];

  for (const [i, f] of files.entries()) {
    const seq = String(i + 1).padStart(6, '0');

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const journey = await tx.candidateJourney.upsert({
        where: { uzaId_cohortId: { uzaId: f.uzaId, cohortId: cohort.id } },
        create: {
          ref: `UZM-CJ-2026-${seq}`,
          uzaId: f.uzaId,
          cohortId: cohort.id,
          stage: 'SCREENING',
          intakeSource: IntakeSource.LENDER_REFERRAL,
          referredBy: 'LOLC Unguka Finance',
          referredOn: f.createdAt,
        },
        update: {},
      });

      // The stage they are genuinely at. Registered, then screened — and nothing beyond
      // that, because nothing beyond that has happened.
      const existingEvents = await tx.journeyEvent.count({ where: { journeyId: journey.id } });
      if (existingEvents === 0) {
        await tx.journeyEvent.createMany({
          data: [
            { journeyId: journey.id, toStage: 'REGISTERED', note: 'Referred by LOLC Unguka Finance' },
            {
              journeyId: journey.id,
              fromStage: 'REGISTERED',
              toStage: 'SCREENING',
              note: 'On the referral list, so the bank has looked and set them aside',
            },
          ],
        });
      }

      await tx.screening.upsert({
        where: { ref: `UZM-SCR-2026-${seq}` },
        create: {
          ref: `UZM-SCR-2026-${seq}`,
          journeyId: journey.id,
          screenedBy: 'Unguka credit staff',
          screenedByOrg: 'LOLC Unguka Finance',
          screenedAt: f.createdAt,
          fundableToday: false,
          fundableInPrinciple: true,
          summary:
            'On the referral list: the bank considers them fundable as a person but cannot fund them today. The specific criteria they fail have not been recorded per individual and must be captured at re-screening.',
        },
        update: {},
      });
      screenings += 1;

      // Gap 1 — contribution, only where their own stated figure is below the threshold.
      const stated = f.contributionRwf ?? 0n;
      if (stated < REQUIRED_CONTRIBUTION_RWF) {
        const short = REQUIRED_CONTRIBUTION_RWF - stated;
        await tx.eligibilityGap.upsert({
          where: { journeyId_kind: { journeyId: journey.id, kind: GapKind.CONTRIBUTION_SHORT } },
          create: {
            journeyId: journey.id,
            kind: GapKind.CONTRIBUTION_SHORT,
            status: 'OPEN',
            shortfallRwf: short,
            detail: `Stated contribution RWF ${stated.toLocaleString('en-GB')} against a working threshold of RWF ${REQUIRED_CONTRIBUTION_RWF.toLocaleString('en-GB')}. Threshold UNVERIFIED until the Unguka term sheet exists.`,
            raisedBy: 'Unguka referral list',
            raisedByRole: 'lender',
            raisedAt: f.createdAt,
          },
          update: { shortfallRwf: short },
        });
        shortTotal += short;
        shortCount.push(Number(short));
        gapRows += 1;
      }

      // Gap 2 — no measured income, which is true of everyone because the placement
      // programme has not run. This is the gap the programme is actually built to close.
      await tx.eligibilityGap.upsert({
        where: { journeyId_kind: { journeyId: journey.id, kind: GapKind.NO_VERIFIABLE_INCOME } },
        create: {
          journeyId: journey.id,
          kind: GapKind.NO_VERIFIABLE_INCOME,
          status: 'OPEN',
          detail:
            'No placement days recorded, so there is no measured daily net. Closes when the placement programme produces a verified earnings record.',
          raisedBy: 'UZA',
          raisedByRole: 'uza',
        },
        update: {},
      });
      gapRows += 1;
      journeys += 1;
    });
  }

  const fmt = (n: bigint | number) => `RWF ${Number(n).toLocaleString('en-GB')}`;
  console.log(`cohort ${cohort.code}: ${cohort.seatsPlanned} seats — ${cohort.seatsForReferrals} referrals, ${cohort.seatsForRecruits} UZA recruits`);
  console.log(`${journeys} journeys opened at SCREENING, ${screenings} screenings recorded`);
  console.log(`${gapRows} eligibility gaps opened`);
  console.log(`  contribution short : ${shortCount.length} people, ${fmt(shortTotal)} in total`);
  console.log(`  no measured income : ${journeys} people — every one of them`);
  console.log(`\nThe cohort holds ${cohort.seatsPlanned} seats and ${journeys} people are waiting.`);
  console.log('That gap is the finding, not a rounding error.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
