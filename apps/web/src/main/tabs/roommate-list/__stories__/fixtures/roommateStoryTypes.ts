import type { MatchRequestActionResponse } from '@repo/shared/match/contract';
import type { PublicProfile } from '@repo/shared/profile/contract';
import type {
  RoommateSearchManifestResponse,
  RoommateSearchResponse,
  RoommateSearchScope,
} from '@repo/shared/roommate-search/contract';
import type { BookmarkListResponse } from '@repo/shared/social-safety/bookmark';
import type { CreateBlockResponse } from '@repo/shared/social-safety/block';
import type { CreateReportResponse } from '@repo/shared/social-safety/report';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { UserProfile } from '@/main/model/profile';

export const ROOMMATE_STORY_AGE_BAND_CODES = ['20', '21', '22', '23', '24', '25_PLUS'] as const;

export type RoommateStoryCategory = 'search' | 'detail' | 'action';
export type RoommateStorySeasonGroup = 'offSeason' | 'seasonOpen' | 'seasonMatching' | 'postMatch';
export type RoommateStoryAutoOpen =
  | 'bookmark-toggle'
  | 'filter-sheet'
  | 'detail'
  | 'match-request-dialog'
  | 'match-request-submit'
  | 'block-dialog'
  | 'block-submit'
  | 'report-dialog'
  | 'report-submit'
  | 'report-optional-block-submit';
export type RoommateStoryViewportHint = 'mobile' | 'desktop' | 'long-content';

export interface RoommateStoryScenario {
  readonly key: RoommateStoryScenarioKey;
  readonly title: string;
  readonly description: string;
  readonly category: RoommateStoryCategory;
  readonly seasonGroup: RoommateStorySeasonGroup;
  readonly viewportHint: RoommateStoryViewportHint;
  readonly autoOpen?: RoommateStoryAutoOpen;
  readonly searchEntryAllowed?: boolean;
  readonly searchClosedMessage?: string;
  readonly sameDormitoryRestrictedEmptyState?: {
    readonly title: string;
    readonly message: string;
  };
  readonly viewer: UserProfile;
  readonly seasonContext: SeasonContextValue;
  readonly searchResponse: RoommateSearchResponse;
  readonly searchResponsesByScope?: Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
  readonly manifestResponse?: RoommateSearchManifestResponse;
  readonly searchErrorCode?: string;
  readonly searchErrorStatus?: number;
  readonly searchResponseDelayMs?: number;
  readonly profileResponseDelayMs?: number;
  readonly bookmarkResponse: BookmarkListResponse;
  readonly bookmarkError?: { code: string; status: number };
  readonly profileByTargetUserId: Readonly<Record<string, PublicProfile>>;
  readonly profileErrorByTargetUserId?: Readonly<Record<string, { code: string; status: number }>>;
  readonly matchRequestResponse: MatchRequestActionResponse;
  readonly matchRequestError?: { code: string; status: number };
  readonly responseDelayMs?: number;
  readonly blockResponse: CreateBlockResponse;
  readonly blockError?: { code: string; status: number };
  readonly reportResponse: CreateReportResponse;
  readonly reportError?: { code: string; status: number };
}

export const ROOMMATE_STORY_SCENARIO_KEYS = [
  'offSeasonClosed',
  'seasonOpenRegistered',
  'seasonOpenRegisteredChatting',
  'seasonOpenNotRegistered',
  'seasonOpenDeregistered',
  'seasonOpenRegisteredEmpty',
  'seasonOpenSearchError',
  'seasonOpenLoadingSkeleton',
  'seasonMatchingRegistered',
  'seasonMatchingRegisteredChatting',
  'seasonMatchingActiveMatched',
  'seasonMatchingUnmatched',
  'seasonMatchingDeregistered',
  'seasonMatchingNotRegistered',
  'seasonMatchingNotRegisteredEmpty',
  'seasonMatchingRegisteredEmpty',
  'seasonMatchingSearchError',
  'seasonMatchingLoadingSkeleton',
  'seasonMatchingDetailFullCompatibility',
  'seasonMatchingDetailPending',
  'seasonMatchingDetailEmptyIntro',
  'seasonMatchingExceptionScoreCalculationFailed',
  'seasonMatchingExceptionDetailFetchFailed',
  'seasonMatchingExceptionDetailUnavailable',
  'seasonMatchingExceptionAccessRecheckFailed',
  'seasonMatchingMatchRequestDialog',
  'seasonMatchingMatchRequestPending',
  'seasonMatchingMatchRequestSuccess',
  'seasonMatchingPendingRequests',
  'seasonMatchingMatchRequestFailed',
  'seasonMatchingMatchRequestAlreadyPending',
  'seasonMatchingMatchRequestLimitReached',
  'seasonMatchingMatchRequestTargetMatched',
  'seasonMatchingMatchRequestTargetDeregistered',
  'seasonMatchingBookmarkStaleFailure',
  'seasonMatchingActionBlockedUser',
  'seasonMatchingBlockDialog',
  'seasonMatchingBlockPending',
  'seasonMatchingBlockFailed',
  'seasonMatchingBlockSuccessReceipt',
  'seasonMatchingReportDialog',
  'seasonMatchingReportPending',
  'seasonMatchingReportFailed',
  'seasonMatchingReportSuccessReceipt',
  'seasonMatchingReportOptionalBlockReceipt',
  'postMatchRegistered',
  'postMatchNotRegistered',
  'postMatchDeregistered',
  'postMatchEmpty',
  'postMatchSearchError',
  'postMatchLoadingSkeleton',
] as const;

export type RoommateStoryScenarioKey = (typeof ROOMMATE_STORY_SCENARIO_KEYS)[number];

export const ROOMMATE_STORY_CATEGORY_KEYS = {
  search: [
    'offSeasonClosed',
    'seasonOpenRegistered',
    'seasonOpenRegisteredChatting',
    'seasonOpenNotRegistered',
    'seasonOpenDeregistered',
    'seasonOpenRegisteredEmpty',
    'seasonOpenSearchError',
    'seasonOpenLoadingSkeleton',
    'seasonMatchingRegistered',
    'seasonMatchingRegisteredChatting',
    'seasonMatchingActiveMatched',
    'seasonMatchingUnmatched',
    'seasonMatchingDeregistered',
    'seasonMatchingNotRegistered',
    'seasonMatchingNotRegisteredEmpty',
    'seasonMatchingRegisteredEmpty',
    'seasonMatchingSearchError',
    'seasonMatchingLoadingSkeleton',
    'postMatchRegistered',
    'postMatchNotRegistered',
    'postMatchDeregistered',
    'postMatchEmpty',
    'postMatchSearchError',
    'postMatchLoadingSkeleton',
  ],
  detail: [
    'seasonMatchingDetailFullCompatibility',
    'seasonMatchingDetailPending',
    'seasonMatchingDetailEmptyIntro',
    'seasonMatchingExceptionScoreCalculationFailed',
    'seasonMatchingExceptionDetailFetchFailed',
    'seasonMatchingExceptionDetailUnavailable',
    'seasonMatchingExceptionAccessRecheckFailed',
  ],
  action: [
    'seasonMatchingMatchRequestDialog',
    'seasonMatchingMatchRequestPending',
    'seasonMatchingMatchRequestSuccess',
    'seasonMatchingPendingRequests',
    'seasonMatchingMatchRequestFailed',
    'seasonMatchingMatchRequestAlreadyPending',
    'seasonMatchingMatchRequestLimitReached',
    'seasonMatchingMatchRequestTargetMatched',
    'seasonMatchingMatchRequestTargetDeregistered',
    'seasonMatchingBookmarkStaleFailure',
    'seasonMatchingActionBlockedUser',
    'seasonMatchingBlockDialog',
    'seasonMatchingBlockPending',
    'seasonMatchingBlockFailed',
    'seasonMatchingBlockSuccessReceipt',
    'seasonMatchingReportDialog',
    'seasonMatchingReportPending',
    'seasonMatchingReportFailed',
    'seasonMatchingReportSuccessReceipt',
    'seasonMatchingReportOptionalBlockReceipt',
  ],
} as const satisfies Record<RoommateStoryCategory, readonly RoommateStoryScenarioKey[]>;

export const ROOMMATE_STORY_SEASON_GROUP_KEYS = {
  offSeason: ['offSeasonClosed'],
  seasonOpen: [
    'seasonOpenRegistered',
    'seasonOpenRegisteredChatting',
    'seasonOpenNotRegistered',
    'seasonOpenDeregistered',
    'seasonOpenRegisteredEmpty',
    'seasonOpenSearchError',
    'seasonOpenLoadingSkeleton',
  ],
  seasonMatching: [
    'seasonMatchingRegistered',
    'seasonMatchingRegisteredChatting',
    'seasonMatchingActiveMatched',
    'seasonMatchingUnmatched',
    'seasonMatchingDeregistered',
    'seasonMatchingNotRegistered',
    'seasonMatchingNotRegisteredEmpty',
    'seasonMatchingRegisteredEmpty',
    'seasonMatchingSearchError',
    'seasonMatchingLoadingSkeleton',
    'seasonMatchingDetailFullCompatibility',
    'seasonMatchingDetailPending',
    'seasonMatchingDetailEmptyIntro',
    'seasonMatchingExceptionScoreCalculationFailed',
    'seasonMatchingExceptionDetailFetchFailed',
    'seasonMatchingExceptionDetailUnavailable',
    'seasonMatchingExceptionAccessRecheckFailed',
    'seasonMatchingMatchRequestDialog',
    'seasonMatchingMatchRequestPending',
    'seasonMatchingMatchRequestSuccess',
    'seasonMatchingPendingRequests',
    'seasonMatchingMatchRequestFailed',
    'seasonMatchingMatchRequestAlreadyPending',
    'seasonMatchingMatchRequestLimitReached',
    'seasonMatchingMatchRequestTargetMatched',
    'seasonMatchingMatchRequestTargetDeregistered',
    'seasonMatchingBookmarkStaleFailure',
    'seasonMatchingActionBlockedUser',
    'seasonMatchingBlockDialog',
    'seasonMatchingBlockPending',
    'seasonMatchingBlockFailed',
    'seasonMatchingBlockSuccessReceipt',
    'seasonMatchingReportDialog',
    'seasonMatchingReportPending',
    'seasonMatchingReportFailed',
    'seasonMatchingReportSuccessReceipt',
    'seasonMatchingReportOptionalBlockReceipt',
  ],
  postMatch: [
    'postMatchRegistered',
    'postMatchNotRegistered',
    'postMatchDeregistered',
    'postMatchEmpty',
    'postMatchSearchError',
    'postMatchLoadingSkeleton',
  ],
} as const satisfies Record<RoommateStorySeasonGroup, readonly RoommateStoryScenarioKey[]>;
