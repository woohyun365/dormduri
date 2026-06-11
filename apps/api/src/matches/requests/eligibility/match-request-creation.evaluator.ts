import { Inject, Injectable } from '@nestjs/common';
import type { ActiveMatchSummary, CreateMatchRequestRequest } from '@repo/shared/match/contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { buildCurrentUserCapabilities } from '../../../season-participants/capabilities/index.js';
import { buildCurrentUserCapabilityInput } from '../../../season-participants/capabilities/index.js';
import { canCurrentDormitoryMatch } from '../../../season-participants/policies/index.js';
import {
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
  resolvePublicTargetPolicy,
  toOperatedDormitoryIdSet,
} from '../../../season-participants/public-target-policy/index.js';
import { SeasonParticipantsService } from '../../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import { parseLifestyleOrNull } from '../../../profiles/contracts/public-profile.presenter.js';
import {
  MATCH_ACTIVE_VIEW_PORT,
  type MatchActiveViewPort,
} from '../../application/ports/match-active-view.port.js';
import { createMatchContextOwner } from '../../context/match-context.resolver.js';
import type { MatchParticipantUserProjection } from '../../context/match-context.resolver.js';
import { matchesErrors } from '../../errors/matches.errors.js';
import { buildParticipantPairIdentity } from '../../persistence/match-pair-identity.js';
import { canStartMatchRequestCreation } from '../policies/match-request-creation.policy.js';
import {
  MATCH_REQUEST_NOTE_MODERATION_PORT,
  type MatchRequestNoteModerationPort,
} from '../ports/match-request-note-moderation.port.js';

export interface PreparedMatchRequestCreation {
  seasonId: string;
  requesterParticipantId: string;
  receiverParticipantId: string;
  pairIdentity: ReturnType<typeof buildParticipantPairIdentity>;
  requesterRoomSelectionDate: string;
  note: string | null;
}

@Injectable()
export class MatchRequestCreationEvaluator {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    @Inject(MATCH_ACTIVE_VIEW_PORT)
    private readonly matchActiveView: MatchActiveViewPort,
    @Inject(MATCH_REQUEST_NOTE_MODERATION_PORT)
    private readonly noteModeration: MatchRequestNoteModerationPort,
  ) {}

  private get contextOwner() {
    return createMatchContextOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      requestTargetNotFound: () => matchesErrors.requestTargetNotFound(),
      requestSelfTargetNotAllowed: () => matchesErrors.requestSelfTargetNotAllowed(),
    });
  }

  async prepareMatchRequestCreation(
    requesterUserId: string,
    input: CreateMatchRequestRequest,
    now: Date,
  ): Promise<PreparedMatchRequestCreation> {
    const requesterContext = await this.contextOwner.getCurrentMatchContext(requesterUserId, now);
    if (!requesterContext?.seasonContext || !requesterContext.participant) {
      throw matchesErrors.requestNotAllowed();
    }

    const targetUser = await this.getValidatedTargetUserForMatchRequest(
      input.targetUserId,
      requesterContext.user,
    );
    const targetParticipant = await this.seasonParticipantsService.findCurrentSeasonParticipant(
      targetUser.id,
      requesterContext.seasonContext.season.id,
    );
    if (!targetParticipant) {
      throw matchesErrors.requestTargetNotFound();
    }

    const targetSelection =
      this.seasonParticipantsService.selectCanonicalSelection(targetParticipant);
    const targetRegistrationSnapshotExists =
      await this.seasonParticipantsService.hasRegistrationSnapshotForParticipant(
        targetParticipant.id,
      );
    const activeMatchMap = await this.getLiveActiveMatchMapForParticipantIds(
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

    if (
      !canStartMatchRequestCreation({
        requesterCanRequestMatch: requesterCapabilities.canRequestMatch,
        targetCanRequestMatch: publicTargetPolicy.actions.canRequestMatch,
      })
    ) {
      throw matchesErrors.requestNotAllowed();
    }

    const note = await this.noteModeration.moderateMatchRequestNote(input.note);
    const requesterRoomSelectionDate = this.findRoomSelectionDate(
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
  }

  private async getValidatedTargetUserForMatchRequest(
    targetUserId: string,
    requesterUser: MatchParticipantUserProjection,
  ): Promise<MatchParticipantUserProjection> {
    return this.contextOwner.getValidatedTargetUserForMatchRequest(targetUserId, requesterUser);
  }

  private findRoomSelectionDate(
    seasonContext: NonNullable<Awaited<ReturnType<SeasonContextPort['getCurrentSeasonContext']>>>,
    dormitoryId: string | null,
  ) {
    return this.contextOwner.findRoomSelectionDate(seasonContext, dormitoryId);
  }

  private async getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>> {
    return this.matchActiveView.getLiveActiveMatchMapForParticipantIds(seasonId, participantIds);
  }
}
