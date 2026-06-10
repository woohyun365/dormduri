import type { MatchRequestSummary } from '@repo/shared/match/contract';
import type { RoommateSearchSummary } from '@repo/shared/roommate-search-contract';
import { resolvePublicCounterpartNickname } from '../../../privacy/deidentification/deidentified-display.policy.js';
import type { MatchRequestRecord } from '../persistence/match-request.select.js';

export function toMatchRequestSummary(
  request: MatchRequestRecord,
  viewerParticipantId: string,
): MatchRequestSummary {
  const sent = request.requesterParticipantId === viewerParticipantId;

  return {
    id: request.id,
    seasonId: request.seasonId,
    direction: sent ? 'SENT' : 'RECEIVED',
    counterpartUserId: sent
      ? request.receiverParticipant.userId
      : request.requesterParticipant.userId,
    counterpartParticipantId: sent ? request.receiverParticipantId : request.requesterParticipantId,
    status: request.status,
    note: request.note,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
    terminalAt: request.terminalAt?.toISOString() ?? null,
    acceptedAt: request.acceptedAt?.toISOString() ?? null,
    terminalReason: request.terminalReason,
    counterpartSummary: toMatchRequestCounterpartSummary(
      sent ? request.receiverParticipant : request.requesterParticipant,
    ),
  };
}

function toMatchRequestCounterpartSummary(
  participant: MatchRequestRecord['requesterParticipant'],
): RoommateSearchSummary {
  return {
    id: participant.userId,
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: { type: 'GENERAL' },
    exposure: {
      listSummaryVisible: true,
      canViewFull: false,
      detailViewable: false,
      scoreVisible: false,
    },
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
      unavailableReasons: ['TARGET_NOT_PUBLIC'],
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
  };
}

function resolveMatchRequestCounterpartNickname(
  participant: MatchRequestRecord['requesterParticipant'],
) {
  return resolvePublicCounterpartNickname({
    deletedAt: participant.user?.deletedAt,
    nicknameSnapshot: participant.profile?.nicknameSnapshot,
  });
}
