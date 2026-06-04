import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
  type ActiveMatchParticipantContextRequirement,
  type DomainContextRequirement,
} from '../common/domain-context/domain-context.decorator.js';
import { badRequestError, unauthorizedError } from '../platform/http/api-error.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { matchesErrors } from './matches.errors.js';
import {
  setActiveMatchContext,
  type ActiveMatchContextRequest,
} from './active-match-context.types.js';

@Injectable()
export class ActiveMatchContextGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.resolveActiveMatchRequirement(context);
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ActiveMatchContextRequest>();
    if (!request.authUser) {
      throw unauthorizedError('UNAUTHENTICATED', '로그인이 필요합니다.');
    }

    const activeMatchId = resolveRequiredParam(request, requirement.param);
    const activeMatch = await this.prisma.activeMatch.findUnique({
      where: { id: activeMatchId },
      select: {
        id: true,
        participantAId: true,
        participantBId: true,
        status: true,
        endedAt: true,
        participantA: {
          select: {
            userId: true,
          },
        },
        participantB: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!activeMatch) {
      throw matchesErrors.activeMatchNotFound();
    }

    if (activeMatch.status !== 'ACTIVE' || activeMatch.endedAt !== null) {
      throw activeMatchFailureError(requirement);
    }

    const actorParticipantId =
      activeMatch.participantA.userId === request.authUser.id
        ? activeMatch.participantAId
        : activeMatch.participantB.userId === request.authUser.id
          ? activeMatch.participantBId
          : null;

    if (!actorParticipantId) {
      throw activeMatchFailureError(requirement);
    }

    setActiveMatchContext(request, {
      activeMatchId: activeMatch.id,
      actorUserId: request.authUser.id,
      actorParticipantId,
      counterpartParticipantId:
        actorParticipantId === activeMatch.participantAId
          ? activeMatch.participantBId
          : activeMatch.participantAId,
      status: activeMatch.status,
      endedAt: activeMatch.endedAt,
    });

    return true;
  }

  private resolveActiveMatchRequirement(
    context: ExecutionContext,
  ): ActiveMatchParticipantContextRequirement | null {
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
        (requirement): requirement is ActiveMatchParticipantContextRequirement =>
          requirement.kind === 'active-match-participant',
      ) ?? null
    );
  }
}

function resolveRequiredParam(request: ActiveMatchContextRequest, param: 'id') {
  const value = request.params?.[param];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequestError('ACTIVE_MATCH_ID_REQUIRED', 'active match id가 필요합니다.');
  }

  return value.trim();
}

function activeMatchFailureError(requirement: ActiveMatchParticipantContextRequirement) {
  return requirement.failure === 'unmatch-cancel-not-allowed'
    ? matchesErrors.unmatchRequestCancelNotAllowed()
    : matchesErrors.unmatchRequestNotAllowed();
}
