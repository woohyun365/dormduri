import { Injectable } from '@nestjs/common';
import type {
  SeasonProfileDraftRequest,
  SeasonProfileDraftResponse,
  SelectableDormitoriesResponse,
  SelectedDormitorySubmitRequest,
  DormitorySelectionDraftResponse,
  SeasonRegistrationFinalizeResponse,
} from '@repo/shared/season-contract';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { createSeasonParticipantSourceOwner } from './season-participant-source-owner.js';
import { createSeasonParticipantWriteOwner } from './season-participant-write-owner.js';
import type {
  CurrentSeasonParticipantProfileRecord,
  CurrentSeasonParticipantRecord,
  SeasonParticipantEnsureInput,
  SeasonParticipantBackfillResult,
  CanonicalSelectionState,
} from './season-participant-records.js';

export type {
  SeasonParticipantEnsureInput,
  CurrentSeasonParticipantProfileRecord,
  CurrentSeasonParticipantRecord,
  CanonicalSelectionState,
  SeasonParticipantBackfillResult,
};

@Injectable()
export class SeasonParticipantsService {
  private readonly sourceOwner = createSeasonParticipantSourceOwner();
  private readonly writeOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
  ) {
    this.writeOwner = createSeasonParticipantWriteOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
    });
  }

  async ensureCurrentSeasonParticipant(
    user: SeasonParticipantEnsureInput,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    return this.writeOwner.ensureCurrentSeasonParticipant(user, now, tx);
  }

  async findCurrentSeasonParticipant(
    userId: string,
    seasonId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    return this.writeOwner.findCurrentSeasonParticipant(userId, seasonId, tx);
  }

  async getCurrentSeasonProfile(userId: string, now?: Date): Promise<SeasonProfileDraftResponse> {
    return this.writeOwner.getCurrentSeasonProfile(userId, now);
  }

  async createOrUpdateSeasonProfileDraft(
    userId: string,
    input: SeasonProfileDraftRequest,
    now?: Date,
  ): Promise<SeasonProfileDraftResponse> {
    return this.writeOwner.createOrUpdateSeasonProfileDraft(userId, input, now);
  }

  validateSeasonProfileCompleteness(
    profile: CurrentSeasonParticipantProfileRecord | null | undefined,
  ) {
    return this.writeOwner.validateSeasonProfileCompleteness(profile);
  }

  assertSeasonProfileCompleteForRegistration(
    profile: CurrentSeasonParticipantProfileRecord | null | undefined,
  ) {
    return this.writeOwner.assertSeasonProfileCompleteForRegistration(profile);
  }

  async listSelectableDormitoriesForCurrentSeason(
    userId: string,
    now?: Date,
  ): Promise<SelectableDormitoriesResponse> {
    return this.writeOwner.listSelectableDormitoriesForCurrentSeason(userId, now);
  }

  async hasSelectableDormitoriesForCurrentParticipant(
    participant: CurrentSeasonParticipantRecord | null,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    return this.writeOwner.hasSelectableDormitoriesForCurrentParticipant(
      participant,
      seasonContext,
      now,
    );
  }

  async hasSelectableDormitoriesForCurrentUser(
    user: SeasonParticipantEnsureInput,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    return this.writeOwner.hasSelectableDormitoriesForCurrentUser(user, seasonContext, now);
  }

  async hasValidDormitorySelectionForCurrentParticipant(
    participant: CurrentSeasonParticipantRecord | null,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    return this.writeOwner.hasValidDormitorySelectionForCurrentParticipant(
      participant,
      seasonContext,
      now,
    );
  }

  async createOrUpdateDormitorySelection(
    userId: string,
    input: SelectedDormitorySubmitRequest,
    now?: Date,
  ): Promise<DormitorySelectionDraftResponse> {
    return this.writeOwner.createOrUpdateDormitorySelection(userId, input, now);
  }

  async finalizeSeasonRegistration(
    userId: string,
    now?: Date,
  ): Promise<SeasonRegistrationFinalizeResponse> {
    return this.writeOwner.finalizeSeasonRegistration(userId, now);
  }

  async deregisterCurrentSeasonParticipation(
    userId: string,
    now?: Date,
  ): Promise<CurrentSeasonParticipantRecord> {
    return this.writeOwner.deregisterCurrentSeasonParticipation(userId, now);
  }

  async backfillCurrentSeasonParticipants(now: Date): Promise<SeasonParticipantBackfillResult[]> {
    return this.writeOwner.backfillCurrentSeasonParticipants(now);
  }

  selectCanonicalSelection(
    participant: Pick<
      CurrentSeasonParticipantRecord,
      | 'dormitoryId'
      | 'dormitorySelectionState'
      | 'participationIntent'
      | 'registeredAt'
      | 'declinedAt'
      | 'participantStatus'
    > | null,
  ): CanonicalSelectionState {
    return this.sourceOwner.selectCanonicalSelection(participant);
  }

  pickCurrentSeasonParticipant(
    participants: CurrentSeasonParticipantRecord[] | null | undefined,
  ): CurrentSeasonParticipantRecord | null {
    return this.sourceOwner.pickCurrentSeasonParticipant(participants);
  }
}
