import { z } from 'zod';
import { isoDateTimeStringSchema, localDateStringSchema } from '../date/primitives.js';
import { dormitorySelectionStateSchema } from '../dormitory/enums.js';
import { activeMatchSummarySchema, matchRequestSummarySchema } from '../match/contract/index.js';
import {
  dormitorySeasonOperationSchema,
  seasonScheduleSchema,
  seasonStateSchema,
  seasonSummarySchema,
} from '../season/runtime/primitives.js';
import {
  currentUserSeasonProfileStateSchema,
  dismissedNoticeStateSchema,
} from '../user/current-user.js';
import { authenticatedSessionUserSchema, selectionSourceSchema } from '../user/primitives.js';
import { userDisplayIdentitySchema } from '../user/identity/display.js';
import { userAcademicIdentitySchema } from '../user/identity/academic.js';

export const homeDashboardSeasonSchema = z.strictObject({
  hasCurrentSeason: z.boolean(),
  state: seasonStateSchema.nullable(),
  summary: seasonSummarySchema.nullable(),
  schedule: seasonScheduleSchema.nullable(),
  isOpen: z.boolean(),
  isMatching: z.boolean(),
  isPostMatch: z.boolean(),
  daysUntilMatchingEnd: z.number().int().nonnegative().nullable(),
  daysUntilSeasonEnd: z.number().int().nonnegative().nullable(),
});

export const homeDashboardViewerCapabilitiesSchema = z.strictObject({
  canEnterRoommateSearch: z.boolean(),
  canCreateOrUpdateSeasonProfileDraft: z.boolean(),
  canSelectDormitory: z.boolean(),
  canFinalizeSeasonRegistration: z.boolean(),
  canRequestMatch: z.boolean(),
  canStartChat: z.boolean(),
  canViewMatchHistory: z.boolean(),
});

export const homeDashboardViewerIdentitySchema = z.strictObject({
  user: authenticatedSessionUserSchema,
  displayIdentity: userDisplayIdentitySchema,
  academicIdentity: userAcademicIdentitySchema,
});

export const homeDashboardViewerSchema = z.strictObject({
  campusOperated: z.boolean(),
  identity: homeDashboardViewerIdentitySchema,
  seasonProfile: currentUserSeasonProfileStateSchema,
  selection: z.strictObject({
    state: dormitorySelectionStateSchema,
    dormitoryId: z.string().nullable(),
    source: selectionSourceSchema.nullable(),
  }),
  match: z.strictObject({
    hasActiveMatch: z.boolean(),
    activeMatch: activeMatchSummarySchema.nullable(),
  }),
  capabilities: homeDashboardViewerCapabilitiesSchema,
  onboarding: z.strictObject({
    dismissedNotices: z.array(dismissedNoticeStateSchema),
  }),
});

export const homeDashboardStatsSchema = z.strictObject({
  totalParticipants: z.number().int().nonnegative(),
  assignedParticipants: z.number().int().nonnegative(),
  buildingTotal: z.number().int().nonnegative(),
  buildingMatchable: z.number().int().nonnegative(),
  todayNewTotal: z.number().int().nonnegative(),
  todayNewBuilding: z.number().int().nonnegative(),
  totalMatchSuccess: z.number().int().nonnegative(),
  buildingMatchSuccess: z.number().int().nonnegative(),
});

export const homeDashboardLastSeasonViewerFinalResultSchema = z.enum([
  'NOT_PARTICIPATED',
  'NO_MATCH',
  'MATCHED',
  'UNMATCHED_AFTER_SUCCESS',
]);

export const homeDashboardSeasonHistorySummarySchema = z.strictObject({
  lastSeason: z
    .strictObject({
      id: z.string(),
      name: z.string(),
      totalParticipants: z.number().int().nonnegative(),
      totalMatchSuccess: z.number().int().nonnegative(),
      viewerHadRegistration: z.boolean(),
      viewerHadMatchSuccess: z.boolean(),
      viewerActivity: z.strictObject({
        sentRequestCount: z.number().int().nonnegative(),
        receivedRequestCount: z.number().int().nonnegative(),
        conversationCount: z.number().int().nonnegative(),
        finalResult: homeDashboardLastSeasonViewerFinalResultSchema,
        matchedPartnerNickname: z.string().nullable(),
      }),
      aggregate: z.strictObject({
        matchedPairCount: z.number().int().nonnegative(),
        operatedDormitoryCount: z.number().int().nonnegative(),
      }),
    })
    .nullable(),
});

export const homeDashboardNextSeasonPreviewSchema = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    preparationStartDate: localDateStringSchema,
    matchingStartDate: localDateStringSchema,
    seasonEndDate: localDateStringSchema,
    visibleToUser: z.boolean(),
    operatedDormitories: z.array(dormitorySeasonOperationSchema),
  })
  .nullable();

export const homeDashboardMatchingSchema = z.strictObject({
  pendingSentCount: z.number().int().nonnegative(),
  pendingReceivedCount: z.number().int().nonnegative(),
  unreadMessageCount: z.number().int().nonnegative(),
  activeMatch: activeMatchSummarySchema.nullable(),
  recentReceivedRequests: z.array(matchRequestSummarySchema),
});

export const homeDashboardResponseSchema = z.strictObject({
  season: homeDashboardSeasonSchema,
  viewer: homeDashboardViewerSchema,
  stats: homeDashboardStatsSchema,
  matching: homeDashboardMatchingSchema,
  seasonHistorySummary: homeDashboardSeasonHistorySummarySchema,
  nextSeasonPreview: homeDashboardNextSeasonPreviewSchema,
  generatedAt: isoDateTimeStringSchema,
});

export type HomeDashboardSeason = z.infer<typeof homeDashboardSeasonSchema>;
export type HomeDashboardViewerCapabilities = z.infer<typeof homeDashboardViewerCapabilitiesSchema>;
export type HomeDashboardViewerIdentity = z.infer<typeof homeDashboardViewerIdentitySchema>;
export type HomeDashboardViewer = z.infer<typeof homeDashboardViewerSchema>;
export type HomeDashboardStats = z.infer<typeof homeDashboardStatsSchema>;
export type HomeDashboardLastSeasonViewerFinalResult = z.infer<
  typeof homeDashboardLastSeasonViewerFinalResultSchema
>;
export type HomeDashboardMatching = z.infer<typeof homeDashboardMatchingSchema>;
export type HomeDashboardSeasonHistorySummary = z.infer<
  typeof homeDashboardSeasonHistorySummarySchema
>;
export type HomeDashboardNextSeasonPreview = z.infer<typeof homeDashboardNextSeasonPreviewSchema>;
export type HomeDashboardResponse = z.infer<typeof homeDashboardResponseSchema>;
