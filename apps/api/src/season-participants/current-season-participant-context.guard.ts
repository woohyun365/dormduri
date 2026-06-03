import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma } from '../generated/prisma/client.js';
import {
  DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
  type CurrentSeasonParticipantContextRequirement,
  type DomainContextRequirement,
} from '../common/domain-context/domain-context.decorator.js';
import { forbiddenError, unauthorizedError } from '../common/http/api-error.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonParticipantsService } from './season-participants.service.js';
import {
  setCurrentSeasonParticipantContext,
  type CurrentSeasonParticipantContextRequest,
} from './current-season-participant-context.types.js';

const currentSeasonParticipantUserSelect = {
  id: true,
  emailVerifiedAt: true,
  deletedAt: true,
  gender: true,
  campus: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class CurrentSeasonParticipantContextGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.resolveCurrentSeasonParticipantRequirement(context);
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<CurrentSeasonParticipantContextRequest>();

    if (!request.authUser) {
      throw unauthorizedError('UNAUTHENTICATED', '로그인이 필요합니다.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.authUser.id },
      select: currentSeasonParticipantUserSelect,
    });

    if (!user || !user.emailVerifiedAt || user.deletedAt) {
      throw currentSeasonParticipantContextRequired();
    }

    const databaseNow = await this.prisma.getDatabaseNow();
    const participant =
      requirement.mode === 'ensure'
        ? await this.seasonParticipantsService.ensureCurrentSeasonParticipant(user, databaseNow)
        : null;

    if (!participant) {
      throw currentSeasonParticipantContextRequired();
    }

    setCurrentSeasonParticipantContext(request, participant);
    return true;
  }

  private resolveCurrentSeasonParticipantRequirement(
    context: ExecutionContext,
  ): CurrentSeasonParticipantContextRequirement | null {
    const requirements = [
      ...(this.reflector.get<readonly DomainContextRequirement[]>(
        DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
        context.getClass(),
      ) ?? []),
      ...(this.reflector.get<readonly DomainContextRequirement[]>(
        DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
        context.getHandler(),
      ) ?? []),
    ];

    return (
      requirements.find(
        (requirement): requirement is CurrentSeasonParticipantContextRequirement =>
          requirement.kind === 'current-season-participant',
      ) ?? null
    );
  }
}

function currentSeasonParticipantContextRequired() {
  return forbiddenError(
    'CURRENT_SEASON_PARTICIPANT_CONTEXT_REQUIRED',
    '현재 시즌 참여자 컨텍스트를 확인할 수 없습니다.',
  );
}
