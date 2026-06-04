import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
  type DomainContextRequirementBase,
  isDomainContextRequirement,
} from '../../platform/domain-context/domain-context.decorator.js';
import { forbiddenError, unauthorizedError } from '../../platform/http/api-error.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { CurrentSeasonParticipantContextRequirement } from './current-season-participant-context-requirement.js';
import { CurrentSeasonParticipantContextResolver } from './current-season-participant-context.resolver.js';
import {
  setCurrentSeasonParticipantContext,
  type CurrentSeasonParticipantContextRequest,
} from './current-season-participant-context.types.js';

@Injectable()
export class CurrentSeasonParticipantContextGuard implements CanActivate {
  constructor(
    private readonly resolver: CurrentSeasonParticipantContextResolver,
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

    const participant = await this.resolver.resolveForActor({
      actorUserId: request.authUser.id,
      requirement,
    });

    if (!participant) {
      throw currentSeasonParticipantFailureError(requirement);
    }

    setCurrentSeasonParticipantContext(request, participant);
    return true;
  }

  private resolveCurrentSeasonParticipantRequirement(
    context: ExecutionContext,
  ): CurrentSeasonParticipantContextRequirement | null {
    const requirements = [
      ...(this.reflector.get<readonly DomainContextRequirementBase[]>(
        DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
        context.getClass(),
      ) ?? []),
      ...(this.reflector.get<readonly DomainContextRequirementBase[]>(
        DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
        context.getHandler(),
      ) ?? []),
    ];

    return (
      requirements.find((requirement): requirement is CurrentSeasonParticipantContextRequirement =>
        isDomainContextRequirement<CurrentSeasonParticipantContextRequirement>(
          requirement,
          'current-season-participant',
        ),
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

function currentSeasonParticipantFailureError(
  requirement: CurrentSeasonParticipantContextRequirement,
) {
  switch (requirement.failure) {
    case 'season-profile-draft-not-allowed':
      return seasonParticipantsErrors.seasonProfileDraftNotAllowed();
    case 'registration-not-allowed':
      return seasonParticipantsErrors.registrationNotAllowed();
    case 'context-required':
      return currentSeasonParticipantContextRequired();
  }
}
