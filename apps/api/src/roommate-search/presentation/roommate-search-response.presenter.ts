import type {
  RoommateSearchPurpose,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search-contract';
import type {
  ResolvedVisibleProfileEntry,
  VisibleProfileViewerContext,
} from '../../profiles/contracts/profile-public-target-reader.port.js';
import type {
  RoommateSearchCursorBoundary,
  RoommateSearchTokenOwner,
} from '../pagination/roommate-search-token.codec.js';

export interface RoommateSearchMaterializedItem {
  entry: ResolvedVisibleProfileEntry;
  summary: RoommateSearchSummary;
  cursorBoundary: RoommateSearchCursorBoundary;
}

export function createRoommateSearchResponseOwner(tokenOwner: RoommateSearchTokenOwner) {
  return {
    toMaterializedItem(input: {
      entry: ResolvedVisibleProfileEntry;
      viewerContext: VisibleProfileViewerContext;
      scope: RoommateSearchScope;
      purpose: RoommateSearchPurpose;
      now: Date;
    }): RoommateSearchMaterializedItem {
      const summary = toRoommateSearchSummary(input.entry, input.purpose);
      const seasonId = input.viewerContext.currentSeasonId;
      if (!seasonId) {
        return {
          entry: input.entry,
          summary,
          cursorBoundary: toCursorBoundary(summary, input.entry),
        };
      }

      return {
        entry: input.entry,
        summary: {
          ...summary,
          detailEntryToken: tokenOwner.signDetailEntryToken({
            viewerUserId: input.viewerContext.viewer.id,
            targetUserId: input.entry.user.id,
            targetParticipantId: input.entry.targetParticipant.id,
            seasonId,
            issuedScope: input.scope,
            issuedRelation: summary.relation.type,
            issuedExposure: {
              listSummaryVisible: true,
              canViewFull: summary.exposure.canViewFull,
              detailViewable: summary.exposure.detailViewable,
              scoreVisible: summary.exposure.scoreVisible,
            },
            now: input.now,
          }),
        },
        cursorBoundary: toCursorBoundary(summary, input.entry),
      };
    },
    summarize(items: RoommateSearchSummary[]): RoommateSearchResponse['resultSummary'] {
      return summarizeResults(items);
    },
  };
}

function toSearchSortKey(entry: ResolvedVisibleProfileEntry) {
  return entry.sourceProfile.nicknameNormalized || entry.sourceProfile.nickname;
}

function toCursorBoundary(
  summary: RoommateSearchSummary,
  entry: ResolvedVisibleProfileEntry,
): RoommateSearchCursorBoundary {
  const base = {
    nicknameSortKey: toSearchSortKey(entry),
    participantId: entry.targetParticipant.id,
  };
  if (typeof summary.matchScore !== 'number') {
    return base;
  }

  return {
    ...base,
    matchScore: summary.matchScore,
  };
}

function toRoommateSearchSummary(
  entry: ResolvedVisibleProfileEntry,
  purpose: RoommateSearchPurpose,
): RoommateSearchSummary {
  const policy = entry.publicTargetPolicy;
  const scoreVisible =
    purpose === 'POST_MATCH_COHORT_REVIEW' ? false : policy.exposure.scoreVisible;
  const base = {
    id: entry.user.id,
    sourceProfile: policy.sourceProfile,
    relation: { type: policy.relation.relationToViewer },
    exposure: {
      listSummaryVisible: true as const,
      detailViewable: policy.exposure.detailViewable,
      canViewFull: policy.exposure.canViewFull,
      scoreVisible,
    },
    actions: policy.actions,
    resultRead: policy.resultRead,
    profileSummary: {
      nickname: entry.sourceProfile.nickname,
      intro: entry.sourceProfile.intro,
      smokingBehavior: entry.sourceProfile.lifestyle.smokingBehavior,
      sleepHabit: entry.sourceProfile.lifestyle.sleepHabit,
      relationshipStyle: entry.sourceProfile.lifestyle.relationshipStyle,
    },
  };

  if (!scoreVisible) {
    return base;
  }

  if (typeof entry.matchScore !== 'number') {
    throw new Error(
      '[roommate-search-response-owner] score-visible summary target must have matchScore',
    );
  }

  return {
    ...base,
    matchScore: entry.matchScore,
  };
}

function summarizeResults(items: RoommateSearchSummary[]): RoommateSearchResponse['resultSummary'] {
  return {
    summaryOnlyCount: items.filter((item) => !item.exposure.detailViewable).length,
    detailViewableCount: items.filter((item) => item.exposure.detailViewable).length,
    scoreVisibleCount: items.filter((item) => item.exposure.scoreVisible).length,
  };
}
