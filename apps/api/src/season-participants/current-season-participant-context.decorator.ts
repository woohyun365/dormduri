import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common';
import { RequireDomainContext } from '../common/domain-context/domain-context.decorator.js';
import { CurrentSeasonParticipantContextGuard } from './current-season-participant-context.guard.js';
import {
  getCurrentSeasonParticipantContext,
  type CurrentSeasonParticipantContextRequest,
} from './current-season-participant-context.types.js';

export type CurrentSeasonParticipantFailureMode =
  | 'context-required'
  | 'season-profile-draft-not-allowed'
  | 'registration-not-allowed';

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
