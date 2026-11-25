import type { LegalPublicationRefusal, LegalWithdrawalRefusal } from '@repo/shared/backoffice';
import {
  legalEffectiveInstant,
  toLegalKstDate,
  type LegalDocumentKind,
  type LegalNoticeClass,
  type LegalVersionKey,
} from '@repo/shared/legal';

/** Days of notice before a version takes effect (legal-basis LB-R10). */
export const LEGAL_NOTICE_DAYS: Readonly<Partial<Record<LegalNoticeClass, number>>> = {
  GENERAL: 7,
  SIGNIFICANT: 30,
};

/** A published version of one kind as the checks read it (dates are KST version keys). */
export interface LegalPublishedVersionFact {
  readonly id: string;
  readonly noticeClass: LegalNoticeClass;
  readonly effectiveDate: LegalVersionKey;
  readonly appliesUntil: LegalVersionKey | null;
  readonly withdrawnAt: Date | null;
}

export interface LegalPublicationCandidate {
  readonly kind: LegalDocumentKind;
  readonly noticeClass: LegalNoticeClass;
  readonly consentRequired: boolean;
  readonly effectiveDate: LegalVersionKey;
  readonly appliesUntil: LegalVersionKey | null;
}

export type LegalCheck<R extends string> =
  { readonly ok: true } | { readonly ok: false; readonly reason: R };

const OK = { ok: true } as const;
const refuse = <R extends string>(reason: R) => ({ ok: false, reason }) as const;

function addDays(versionKey: LegalVersionKey, days: number): LegalVersionKey {
  const date = new Date(`${versionKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Decision-time checks of one publish request. `versions`
 * are the kind's published versions, `now` is the database clock and `recipientCount` the members who
 * can still receive mail. The partial unique indexes stay the last guard for (kind, effective date)
 * and the one first publication per kind.
 */
export function checkLegalPublication(input: {
  readonly candidate: LegalPublicationCandidate;
  readonly versions: readonly LegalPublishedVersionFact[];
  readonly now: Date;
  readonly recipientCount: number;
}): LegalCheck<LegalPublicationRefusal> {
  const { candidate, now } = input;
  const live = input.versions.filter((version) => version.withdrawnAt === null);
  const published = live.filter((version) => version.noticeClass !== 'HISTORICAL');
  const historical = live
    .filter((version) => version.noticeClass === 'HISTORICAL')
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  const approvalDate = toLegalKstDate(now);

  switch (candidate.noticeClass) {
    case 'HISTORICAL': {
      if (published.length > 0) {
        return refuse('first_publication_exists');
      }
      const until = candidate.appliesUntil;
      if (until === null || until >= approvalDate) {
        return refuse('historical_not_before_approval');
      }
      const overlaps = historical.some(
        (record) =>
          record.effectiveDate <= until &&
          candidate.effectiveDate <= (record.appliesUntil ?? record.effectiveDate),
      );
      if (overlaps) {
        return refuse('historical_overlap');
      }
      break;
    }
    case 'INITIAL': {
      if (published.length > 0) {
        return refuse('first_publication_exists');
      }
      if (candidate.effectiveDate > approvalDate) {
        return refuse('initial_after_approval');
      }
      const last = historical.at(-1);
      if (last && candidate.effectiveDate !== addDays(last.appliesUntil ?? last.effectiveDate, 1)) {
        return refuse('initial_not_after_history');
      }
      break;
    }
    case 'GENERAL':
    case 'SIGNIFICANT': {
      // The first version of a kind is always its first publication.
      if (!published.some((version) => version.noticeClass === 'INITIAL')) {
        return refuse('first_publication_required');
      }
      const days = LEGAL_NOTICE_DAYS[candidate.noticeClass] ?? 0;
      if (candidate.effectiveDate < addDays(approvalDate, days)) {
        return refuse('notice_too_short');
      }
      const scheduled = published.some(
        (version) => legalEffectiveInstant(version.effectiveDate).getTime() > now.getTime(),
      );
      if (scheduled) {
        return refuse('scheduled_version_exists');
      }
      break;
    }
  }
  if (live.some((version) => version.effectiveDate === candidate.effectiveDate)) {
    return refuse('effective_date_taken');
  }
  const needsNoMembers = candidate.noticeClass === 'SIGNIFICANT' || candidate.consentRequired;
  if (needsNoMembers && input.recipientCount > 0) {
    return refuse('members_exist');
  }
  return OK;
}

/**
 * A withdrawal request names a scheduled general or significant version that is not withdrawn.
 * The decision writes the withdrawal with a conditional UPDATE on an empty withdrawal time,
 * so a second approval finds no row and the first time stays.
 */
export function checkLegalWithdrawal(input: {
  readonly version: LegalPublishedVersionFact;
  readonly now: Date;
}): LegalCheck<LegalWithdrawalRefusal> {
  const { version, now } = input;
  if (version.noticeClass !== 'GENERAL' && version.noticeClass !== 'SIGNIFICANT') {
    return refuse('not_withdrawable');
  }
  if (version.withdrawnAt !== null) {
    return refuse('already_withdrawn');
  }
  if (legalEffectiveInstant(version.effectiveDate).getTime() <= now.getTime()) {
    return refuse('already_in_effect');
  }
  return OK;
}
