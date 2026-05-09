import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { createSeasonParticipantSourceOwner } from './season-participant-source-owner.js';
import { createSeasonParticipantWriteOwner } from './season-participant-write-owner.js';
import type { ProfileSource } from '@repo/shared/profile-contract';
import type {
  CurrentSeasonParticipantProfileRecord,
  CurrentSeasonParticipantRecord,
  ParticipantBackfillSeed,
  ParticipantBackfillResult,
  CanonicalSelectionState,
  CanonicalProfileSource,
  UserProfileRecord,
} from './season-participant-records.js';

export type {
  ParticipantBackfillSeed,
  CurrentSeasonParticipantProfileRecord,
  CurrentSeasonParticipantRecord,
  CanonicalSelectionState,
  CanonicalProfileSource,
  ParticipantBackfillResult,
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

  async ensureCurrentSeasonParticipantForUser(
    user: ParticipantBackfillSeed,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CurrentSeasonParticipantRecord | null> {
    return this.writeOwner.ensureCurrentSeasonParticipantForUser(user, now, tx);
  }

  async registerCurrentSeasonParticipation(
    userId: string,
    now?: Date,
  ): Promise<CurrentSeasonParticipantRecord> {
    return this.writeOwner.registerCurrentSeasonParticipation(userId, now);
  }

  async backfillCurrentSeasonParticipants(now: Date): Promise<ParticipantBackfillResult[]> {
    return this.writeOwner.backfillCurrentSeasonParticipants(now);
  }

  selectCanonicalSelection(
    user: Pick<ParticipantBackfillSeed, 'dormitoryId' | 'dormitorySelectionState'>,
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
    return this.sourceOwner.selectCanonicalSelection(user, participant);
  }

  selectCanonicalProfile(
    baseProfile: UserProfileRecord,
    participantProfile: CurrentSeasonParticipantProfileRecord | null,
  ): CanonicalProfileSource {
    return this.sourceOwner.selectCanonicalProfile(baseProfile, participantProfile);
  }

  selectProfileBySource(
    baseProfile: UserProfileRecord,
    participantProfile: CurrentSeasonParticipantProfileRecord | null,
    source: ProfileSource,
  ): CanonicalProfileSource {
    return this.sourceOwner.selectProfileBySource(baseProfile, participantProfile, source);
  }

  pickCurrentSeasonParticipant(
    participants: CurrentSeasonParticipantRecord[] | null | undefined,
  ): CurrentSeasonParticipantRecord | null {
    return this.sourceOwner.pickCurrentSeasonParticipant(participants);
  }
}
