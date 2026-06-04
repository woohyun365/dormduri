import type { CreateMatchRequestRequest } from '@repo/shared/match-contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { ModerationService } from '../moderation/moderation.service.js';
import { buildCurrentUserCapabilities } from '../season-participants/capabilities/index.js';
import { canCurrentDormitoryMatch } from '../season-participants/policies/index.js';
import { resolvePublicTargetPolicy } from '../season-participants/public-target-policy/index.js';
import type { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import {
  buildCurrentUserCapabilityInput,
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';
import { matchesErrors } from './matches.errors.js';
import { buildParticipantPairIdentity } from './match.utils.js';
import type { MatchUserContext, MatchParticipantUserProjection } from './match-context-owner.js';
import type { ActiveMatchSummary } from '@repo/shared/match-contract';
import { parseLifestyleOrNull } from '../profiles/profile.mapper.js';

export interface PreparedMatchRequestCreation {
  seasonId: string;
  requesterParticipantId: string;
  receiverParticipantId: string;
  pairIdentity: ReturnType<typeof buildParticipantPairIdentity>;
  requesterRoomSelectionDate: string;
  note: string | null;
}

interface MatchRequestPreparationDeps {
  getCurrentMatchContext(userId: string, now: Date): Promise<MatchUserContext | null>;
  getValidatedTargetUserForMatchRequest(
    targetUserId: string,
    requesterUser: MatchParticipantUserProjection,
  ): Promise<MatchParticipantUserProjection>;
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
        'matchRequestNote',
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
      const targetParticipant = await deps.seasonParticipantsService.findCurrentSeasonParticipant(
        targetUser.id,
        requesterContext.seasonContext.season.id,
      );
      if (!targetParticipant) {
        throw matchesErrors.requestTargetNotFound();
      }

      const targetSelection =
        deps.seasonParticipantsService.selectCanonicalSelection(targetParticipant);
      const targetRegistrationSnapshotExists =
        await deps.seasonParticipantsService.hasRegistrationSnapshotForParticipant(
          targetParticipant.id,
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
        requesterContext.participant?.profile?.lifestyle ?? null,
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
      const publicTargetPolicy = resolvePublicTargetPolicy(
        buildPublicTargetPolicyViewerInput({
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
        buildPublicTargetPolicyTargetInput({
          operatedDormitoryIds,
          participant: targetParticipant,
          matched: targetActiveMatch !== null,
          selection: targetSelection,
          registrationSnapshotExists: targetRegistrationSnapshotExists,
        }),
      );

      if (!requesterCapabilities.canRequestMatch || !publicTargetPolicy.actions.canRequestMatch) {
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
      };
    },
  };
}
