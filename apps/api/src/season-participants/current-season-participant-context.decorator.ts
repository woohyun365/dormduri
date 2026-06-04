import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common';
import { RequireDomainContext } from '../platform/domain-context/domain-context.decorator.js';
import type { CurrentSeasonParticipantContextRequirement } from './context/current-season-participant-context-requirement.js';
import { CurrentSeasonParticipantContextGuard } from './current-season-participant-context.guard.js';
import {
  getCurrentSeasonParticipantContext,
  type CurrentSeasonParticipantContextRequest,
} from './current-season-participant-context.types.js';

export type CurrentSeasonParticipantFailureMode =
  CurrentSeasonParticipantContextRequirement['failure'];

export function RequireCurrentSeasonParticipant(
  failure: CurrentSeasonParticipantFailureMode = 'context-required',
) {
  return applyDecorators(
    RequireDomainContext({
      kind: 'current-season-participant',
      mode: 'ensure',
      source: 'actor-campus',
      failure,
    }),
    UseGuards(CurrentSeasonParticipantContextGuard),
  );
}

export const SeasonParticipant = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<CurrentSeasonParticipantContextRequest>();
    const participant = getCurrentSeasonParticipantContext(request);
    if (!participant) {
      throw new Error('[SeasonParticipant] guard must run before decorator');
    }

    return participant;
  },
);
