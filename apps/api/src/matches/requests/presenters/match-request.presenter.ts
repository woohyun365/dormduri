import type { MatchRequestActions, MatchRequestWithActions } from '@repo/shared/match/contract';
import type { RoommateSearchSummary } from '@repo/shared/roommate-search/contract';
import type { SeasonState } from '@repo/shared/season/runtime';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { ChatThreadSearchMetadata } from '../../../chat/application/ports/chat-thread-search-metadata-reader.port.js';
import { resolvePublicCounterpartNickname } from '../../../privacy/deidentification/deidentified-display.policy.js';
import { parseLifestyleOrNull } from '../../../profiles/contracts/public-profile.presenter.js';
import { createProfileDetailEntryTokenCodec } from '../../../profiles/contracts/profile-detail-entry-token.codec.js';
import { isParticipantRegistered } from '../../../season-participants/policies/index.js';
import { buildDirectionalMatchScoreProjection } from '../../scoring/match-score-projection.js';
import type { MatchRequestRecord } from '../persistence/match-request.select.js';

const profileDetailEntryTokenCodec = createProfileDetailEntryTokenCodec();

export interface MatchRequestSummaryProfileContext {
  readonly viewerUserId: string;
  readonly now: Date;
  readonly seasonState: SeasonState;
  readonly registrationSnapshotParticipantIds: ReadonlySet<string>;
  readonly activeParticipantIds: ReadonlySet<string>;
  readonly activeChatThreadByParticipantId: ReadonlyMap<string, ChatThreadSearchMetadata>;
  readonly currentDormitoryCanMatch: boolean;
}

export function toMatchRequestSummary(
  request: MatchRequestRecord,
  viewerParticipantId: string,
  actions: MatchRequestActions = toStaticMatchRequestActions(request, viewerParticipantId),
  profileContext?: MatchRequestSummaryProfileContext,
): MatchRequestWithActions {
  const sent = request.requesterParticipantId === viewerParticipantId;
  const viewerParticipant = sent ? request.requesterParticipant : request.receiverParticipant;
  const counterpartParticipant = sent ? request.receiverParticipant : request.requesterParticipant;
  const counterpartParticipantId = sent
    ? request.receiverParticipantId
    : request.requesterParticipantId;

  return {
    id: request.id,
    seasonId: request.seasonId,
    direction: sent ? 'SENT' : 'RECEIVED',
    counterpartUserId: sent
      ? request.receiverParticipant.userId
      : request.requesterParticipant.userId,
    counterpartParticipantId,
    status: request.status,
    note: request.note,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
    terminalAt: request.terminalAt?.toISOString() ?? null,
    acceptedAt: request.acceptedAt?.toISOString() ?? null,
    terminalReason: request.terminalReason,
    actions,
    counterpartSummary: toMatchRequestCounterpartSummary({
      request,
      viewerParticipant,
      viewerParticipantId,
      counterpartParticipant,
      counterpartParticipantId,
      profileContext,
    }),
  };
}

function toStaticMatchRequestActions(
  request: MatchRequestRecord,
  viewerParticipantId: string,
): MatchRequestActions {
  if (request.status !== 'PENDING') {
    const reason = request.status === 'EXPIRED' ? 'REQUEST_EXPIRED' : 'REQUEST_ALREADY_RESOLVED';
    return {
      accept: { allowed: false, reason },
      reject: { allowed: false, reason },
      cancel: { allowed: false, reason },
    };
  }

  const sent = request.requesterParticipantId === viewerParticipantId;
  return sent
    ? {
        accept: { allowed: false, reason: null },
        reject: { allowed: false, reason: null },
        cancel: { allowed: true, reason: null },
      }
    : {
        accept: { allowed: true, reason: null },
        reject: { allowed: true, reason: null },
        cancel: { allowed: false, reason: null },
      };
}

function toMatchRequestCounterpartSummary(input: {
  request: MatchRequestRecord;
  viewerParticipant: MatchRequestRecord['requesterParticipant'];
  viewerParticipantId: string;
  counterpartParticipant: MatchRequestRecord['requesterParticipant'];
  counterpartParticipantId: string;
  profileContext?: MatchRequestSummaryProfileContext;
}): RoommateSearchSummary {
  const { request, counterpartParticipant: participant, profileContext } = input;
  const profileProjection = resolveMatchRequestProfileProjection(input);

  return {
    id: participant.userId,
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: { type: 'GENERAL' },
    exposure: {
      listSummaryVisible: true,
      canViewFull: profileProjection.canViewFull,
      detailViewable: profileContext !== undefined,
      scoreVisible: profileProjection.matchScore !== null,
    },
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: profileProjection.canStartChat,
      unavailableReasons: [
        participant.user?.deletedAt
          ? 'TARGET_DELETED_OR_DEIDENTIFIED'
          : request.status === 'PENDING'
            ? 'MATCH_REQUEST_ALREADY_PENDING'
            : 'TARGET_NOT_PUBLIC',
      ],
    },
    resultRead: {
      resultReadable: false,
      context: 'NONE',
    },
    profileSummary: {
      nickname: resolveMatchRequestCounterpartNickname(participant),
      intro: participant.profile?.intro ?? '',
      smokingBehavior: participant.profile?.smokingBehavior ?? null,
      sleepHabit: participant.profile?.sleepHabit ?? null,
      relationshipStyle: participant.profile?.relationshipStyle ?? null,
    },
    ...(profileProjection.detailEntryToken
      ? { detailEntryToken: profileProjection.detailEntryToken }
      : {}),
    ...(profileProjection.matchScore !== null ? { matchScore: profileProjection.matchScore } : {}),
    activeChatThread: profileProjection.activeChatThread
      ? {
          id: profileProjection.activeChatThread.threadId,
          threadKind: profileProjection.activeChatThread.threadKind,
          status: profileProjection.activeChatThread.status,
          ...(profileProjection.activeChatThread.lastMessageAt
            ? { lastMessageAt: profileProjection.activeChatThread.lastMessageAt.toISOString() }
            : {}),
        }
      : null,
  };
}

function resolveMatchRequestProfileProjection(input: {
  request: MatchRequestRecord;
  viewerParticipant: MatchRequestRecord['requesterParticipant'];
  viewerParticipantId: string;
  counterpartParticipant: MatchRequestRecord['requesterParticipant'];
  counterpartParticipantId: string;
  profileContext?: MatchRequestSummaryProfileContext;
}) {
  const {
    request,
    viewerParticipant,
    viewerParticipantId,
    counterpartParticipant,
    profileContext,
  } = input;
  if (!profileContext) {
    return {
      canViewFull: false,
      canStartChat: false,
      matchScore: null,
      detailEntryToken: null,
      activeChatThread: null,
    } as const;
  }

  const viewerLifestyle = parseLifestyleOrNull(viewerParticipant.profile ?? null);
  const counterpartLifestyle = parseLifestyleOrNull(counterpartParticipant.profile ?? null);
  const publicSeason =
    profileContext.seasonState === 'SEASON_OPEN' ||
    profileContext.seasonState === 'SEASON_MATCHING';
  const participantsAreRegistered =
    isRequestParticipantRegistered(viewerParticipant, viewerParticipantId) &&
    isRequestParticipantRegistered(counterpartParticipant, input.counterpartParticipantId) &&
    profileContext.registrationSnapshotParticipantIds.has(viewerParticipantId) &&
    profileContext.registrationSnapshotParticipantIds.has(input.counterpartParticipantId);
  const participantsAreVisible =
    !viewerParticipant.hiddenByAdminAt &&
    !viewerParticipant.deactivatedAt &&
    !counterpartParticipant.hiddenByAdminAt &&
    !counterpartParticipant.deactivatedAt &&
    !counterpartParticipant.user?.deletedAt;
  const sameDormitory =
    viewerParticipant.dormitoryId !== null &&
    viewerParticipant.dormitoryId === counterpartParticipant.dormitoryId;
  const neitherParticipantIsMatched =
    !profileContext.activeParticipantIds.has(viewerParticipantId) &&
    !profileContext.activeParticipantIds.has(input.counterpartParticipantId);
  const profilesAreComplete =
    viewerLifestyle !== null &&
    counterpartLifestyle !== null &&
    isSeasonProfileComplete(viewerLifestyle) &&
    isSeasonProfileComplete(counterpartLifestyle);
  const canViewFull =
    publicSeason &&
    participantsAreRegistered &&
    participantsAreVisible &&
    sameDormitory &&
    neitherParticipantIsMatched &&
    profilesAreComplete;
  const matchScore = canViewFull
    ? buildDirectionalMatchScoreProjection(viewerLifestyle, counterpartLifestyle)
    : null;
  const canStartChat =
    canViewFull &&
    (profileContext.seasonState === 'SEASON_OPEN' || profileContext.currentDormitoryCanMatch);
  const activeChatThread = canStartChat
    ? (profileContext.activeChatThreadByParticipantId.get(input.counterpartParticipantId) ?? null)
    : null;
  const detailEntryToken = profileDetailEntryTokenCodec.sign({
    viewerUserId: profileContext.viewerUserId,
    targetUserId: counterpartParticipant.userId,
    targetParticipantId: input.counterpartParticipantId,
    seasonId: request.seasonId,
    issuedScope: 'SAME_BUILDING_ONLY',
    issuedRelation: 'GENERAL',
    issuedExposure: {
      listSummaryVisible: true,
      canViewFull,
      detailViewable: true,
      scoreVisible: matchScore !== null,
    },
    now: profileContext.now,
  });

  return { canViewFull, canStartChat, matchScore, detailEntryToken, activeChatThread };
}

function isRequestParticipantRegistered(
  participant: MatchRequestRecord['requesterParticipant'],
  participantId: string,
) {
  return isParticipantRegistered({
    participationIntent: participant.participationIntent,
    registeredAt: participant.registeredAt,
    declinedAt: participant.declinedAt,
    dormitoryId: participant.dormitoryId,
    dormitorySelectionState: participant.dormitorySelectionState,
    participantStatus: participant.participantStatus,
    hiddenByAdminAt: participant.hiddenByAdminAt,
    deactivatedAt: participant.deactivatedAt,
    profile: participant.profile ? { participantId } : null,
  });
}

function resolveMatchRequestCounterpartNickname(
  participant: MatchRequestRecord['requesterParticipant'],
) {
  return resolvePublicCounterpartNickname({
    deletedAt: participant.user?.deletedAt,
    nicknameSnapshot: participant.profile?.nicknameSnapshot,
  });
}
