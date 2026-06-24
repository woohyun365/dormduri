import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';
import { dormitorySelectionStateSchema } from '../dormitory/enums.js';
import { activeMatchSummarySchema, matchRequestSummarySchema } from '../match/contract/index.js';
import {
  seasonScheduleSchema,
  seasonStateSchema,
  seasonSummarySchema,
} from '../season/runtime/primitives.js';
import {
  currentUserSeasonProfileStateSchema,
  dismissedNoticeStateSchema,
} from '../user/current-user.js';
import { selectionSourceSchema } from '../user/primitives.js';

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

export const homeDashboardViewerSchema = z.strictObject({
  campusOperated: z.boolean(),
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
  generatedAt: isoDateTimeStringSchema,
});

export type HomeDashboardSeason = z.infer<typeof homeDashboardSeasonSchema>;
export type HomeDashboardViewerCapabilities = z.infer<typeof homeDashboardViewerCapabilitiesSchema>;
export type HomeDashboardViewer = z.infer<typeof homeDashboardViewerSchema>;
export type HomeDashboardStats = z.infer<typeof homeDashboardStatsSchema>;
export type HomeDashboardMatching = z.infer<typeof homeDashboardMatchingSchema>;
export type HomeDashboardResponse = z.infer<typeof homeDashboardResponseSchema>;
