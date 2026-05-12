import type { CreateMatchRequestRequest } from '@repo/shared/match-contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { ModerationService } from '../common/moderation/moderation.service.js';
import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  resolvePublicExposure,
} from '../season-participants/season-participant-policy.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  buildCurrentUserCapabilityInput,
  buildPublicExposureTargetInput,
  buildPublicExposureViewerInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';
import { matchesErrors } from './matches.errors.js';
import { buildParticipantPairIdentity } from './match.utils.js';
import type { MatchUserContext, MatchUserSeed } from './match-context-owner.js';
import type { ActiveMatchSummary } from '@repo/shared/match-contract';
import { parseLifestyleOrNull } from '../profiles/profile.mapper.js';

export interface PreparedMatchRequestCreation {
  seasonId: string;
  requesterParticipantId: string;
  receiverParticipantId: string;
  pairIdentity: ReturnType<typeof buildParticipantPairIdentity>;
  requesterRoomSelectionDate: string;
  note: string | null;
  requestChannel: CreateMatchRequestRequest['channel'] | null;
}

interface MatchRequestPreparationDeps {
  getCurrentMatchContext(userId: string, now: Date): Promise<MatchUserContext | null>;
  getValidatedTargetUserForMatchRequest(
    targetUserId: string,
    requesterUser: MatchUserSeed,
  ): Promise<MatchUserSeed>;
  findRoomSelectionDate(
    seasonContext: NonNullable<MatchUserContext['seasonContext']>,
    dormitoryId: string | null,
  ): string | null;
  getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>>;
  seasonParticipantsService: SeasonParticipantsService;
  moderationService: ModerationService;
}

export function createMatchRequestPreparationOwner(deps: MatchRequestPreparationDeps) {
  return {
    async moderateMatchRequestNote(note: CreateMatchRequestRequest['note']) {
      const trimmedNote = note?.trim() ? note.trim() : null;
      if (!trimmedNote) {
        return null;
      }

      const moderation = await deps.moderationService.moderatePublicText(
        trimmedNote,
        'messageToRoommate',
      );
      if (!moderation.ok) {
        throw matchesErrors.requestNoteModerationRejected(moderation.error);
      }

      return trimmedNote;
    },

    async prepareMatchRequestCreation(
      requesterUserId: string,
      input: CreateMatchRequestRequest,
      now: Date,
    ): Promise<PreparedMatchRequestCreation> {
      const requesterContext = await deps.getCurrentMatchContext(requesterUserId, now);
      if (!requesterContext?.seasonContext || !requesterContext.participant) {
        throw matchesErrors.requestNotAllowed();
      }

      const targetUser = await deps.getValidatedTargetUserForMatchRequest(
        input.targetUserId,
        requesterContext.user,
      );
      const targetParticipant =
        await deps.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(targetUser, now);
      if (!targetParticipant) {
        throw matchesErrors.requestTargetNotFound();
      }

      const targetSelection = deps.seasonParticipantsService.selectCanonicalSelection(
        targetUser,
        targetParticipant,
      );
      const activeMatchMap = await deps.getLiveActiveMatchMapForParticipantIds(
        requesterContext.seasonContext.season.id,
        [requesterContext.participant.id, targetParticipant.id],
      );
      const requesterActiveMatch = activeMatchMap.get(requesterContext.participant.id) ?? null;
      const targetActiveMatch = activeMatchMap.get(targetParticipant.id) ?? null;
      const operatedDormitoryIds = toOperatedDormitoryIdSet(requesterContext.seasonContext);
      const requesterCurrentDormitoryCanMatch = canCurrentDormitoryMatch(
        requesterContext.seasonContext,
        requesterContext.selection.dormitoryId,
        now,
      );
      const requesterLifestyle = parseLifestyleOrNull(
        requesterContext.participant?.profile?.lifestyle ??
          requesterContext.user.profile?.lifestyle ??
          null,
      );
      const requesterSeasonProfileComplete =
        requesterLifestyle !== null && isSeasonProfileComplete(requesterLifestyle);
      const requesterCapabilities = buildCurrentUserCapabilities(
        buildCurrentUserCapabilityInput({
          campusOperated: true,
          seasonState: requesterContext.seasonContext.state,
          participant: requesterContext.participant,
          participantMatched: requesterActiveMatch !== null,
          seasonProfileComplete: requesterSeasonProfileComplete,
          selection: requesterContext.selection,
          operatedDormitoryIds,
          currentDormitoryCanMatch: requesterCurrentDormitoryCanMatch,
          nicknameLockedBySeason: false,
          nicknameCooldownActive: false,
        }),
      );
      const exposure = resolvePublicExposure(
        buildPublicExposureViewerInput({
          campusOperated: true,
          seasonState: requesterContext.seasonContext.state,
          participant: requesterContext.participant,
          matched: requesterActiveMatch !== null,
          seasonProfileComplete: requesterSeasonProfileComplete,
          matchedPartnerParticipantId: requesterActiveMatch?.counterpartParticipantId ?? null,
          selection: requesterContext.selection,
          operatedDormitoryIds,
          currentDormitoryCanMatch: requesterCurrentDormitoryCanMatch,
        }),
        buildPublicExposureTargetInput({
          seasonState: requesterContext.seasonContext.state,
          operatedDormitoryIds,
          participant: targetParticipant,
          matched: targetActiveMatch !== null,
          selection: targetSelection,
        }),
      );

      if (!requesterCapabilities.canRequestMatch || exposure.exposureLevel !== 'FULL') {
        throw matchesErrors.requestNotAllowed();
      }

      const note = await this.moderateMatchRequestNote(input.note);
      const requesterRoomSelectionDate = deps.findRoomSelectionDate(
        requesterContext.seasonContext,
        requesterContext.selection.dormitoryId,
      );
      if (!requesterRoomSelectionDate) {
        throw matchesErrors.requestNotAllowed();
      }

      return {
        seasonId: requesterContext.seasonContext.season.id,
        requesterParticipantId: requesterContext.participant.id,
        receiverParticipantId: targetParticipant.id,
        pairIdentity: buildParticipantPairIdentity(
          requesterContext.participant.id,
          targetParticipant.id,
        ),
        requesterRoomSelectionDate,
        note,
        requestChannel: input.channel ?? null,
      };
    },
  };
}
