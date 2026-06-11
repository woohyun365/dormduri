import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { SeasonParticipantsService } from '../application/season-participants.service.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { CurrentSeasonParticipantContextRequirement } from './current-season-participant-context-requirement.js';

const currentSeasonParticipantUserSelect = {
  id: true,
  emailVerifiedAt: true,
  deletedAt: true,
  gender: true,
  campus: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class CurrentSeasonParticipantContextResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
  ) {}

  async resolveForActor(input: {
    actorUserId: string;
    requirement: CurrentSeasonParticipantContextRequirement;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: currentSeasonParticipantUserSelect,
    });

    if (!user || !user.emailVerifiedAt || user.deletedAt) {
      throw seasonParticipantsErrors.registrationNotAllowed();
    }

    const databaseNow = await this.prisma.getDatabaseNow();
    if (input.requirement.mode !== 'ensure') {
      return null;
    }

    return this.seasonParticipantsService.ensureCurrentSeasonParticipant(user, databaseNow);
  }
}
