import type { LegalNoticeClass, LegalVersionKey, LegalVersionStatus } from './contract.js';

// Korea Standard Time has no daylight saving time, so 00:00 KST is always 15:00 UTC of the day before.
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

/** The moment a version takes effect: 00:00 KST of its effective date. */
export function legalEffectiveInstant(versionKey: LegalVersionKey): Date {
  return new Date(Date.parse(`${versionKey}T00:00:00.000Z`) - KST_OFFSET_MS);
}

/** The KST calendar date of an instant, as a version key. */
export function toLegalKstDate(instant: Date): LegalVersionKey {
  return new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function dayBefore(versionKey: LegalVersionKey): LegalVersionKey {
  return new Date(Date.parse(`${versionKey}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);
}

export interface LegalTimelineVersion {
  readonly effectiveDate: LegalVersionKey;
  readonly noticeClass: LegalNoticeClass;
  /** Set only on a historical record. */
  readonly appliesUntil: LegalVersionKey | null;
  /** Approval time, which is also when the notice starts. */
  readonly publishedAt: Date;
  readonly withdrawnAt: Date | null;
}

export type LegalTimelineEntry<T extends LegalTimelineVersion> = Omit<T, 'appliesUntil'> & {
  readonly status: LegalVersionStatus;
  readonly appliesFrom: LegalVersionKey;
  readonly appliesUntil: LegalVersionKey | null;
  /** Historical and initial versions: the effective date. General and significant ones: the approval date (KST). */
  readonly lastModifiedDate: LegalVersionKey;
};

/**
 * The public timeline of one document kind at `now` (the database clock), newest first.
 *
 * Withdrawn versions and versions whose notice has not started are left out. A historical record is
 * always previous and keeps its given applies-until date. Of the other versions, the latest one in
 * effect is current, later ones are scheduled and earlier ones previous; each applies until the day
 * before the next listed version takes effect. The rules have one owner, so readers never recompute them.
 */
export function buildLegalVersionTimeline<T extends LegalTimelineVersion>(
  versions: readonly T[],
  now: Date,
): Array<LegalTimelineEntry<T>> {
  const nowMs = now.getTime();
  const ascending = versions
    .filter((version) => version.withdrawnAt === null && version.publishedAt.getTime() <= nowMs)
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  const isInEffect = (version: T) =>
    legalEffectiveInstant(version.effectiveDate).getTime() <= nowMs;
  let currentIndex = -1;
  ascending.forEach((version, index) => {
    if (version.noticeClass !== 'HISTORICAL' && isInEffect(version)) {
      currentIndex = index;
    }
  });

  return ascending
    .map((version, index): LegalTimelineEntry<T> => {
      const historical = version.noticeClass === 'HISTORICAL';
      const next = ascending[index + 1];
      let status: LegalVersionStatus = 'previous';
      if (!historical && !isInEffect(version)) {
        status = 'scheduled';
      } else if (index === currentIndex) {
        status = 'current';
      }
      return {
        ...version,
        status,
        appliesFrom: version.effectiveDate,
        appliesUntil: historical
          ? version.appliesUntil
          : next
            ? dayBefore(next.effectiveDate)
            : null,
        lastModifiedDate:
          version.noticeClass === 'GENERAL' || version.noticeClass === 'SIGNIFICANT'
            ? toLegalKstDate(version.publishedAt)
            : version.effectiveDate,
      };
    })
    .reverse();
}
