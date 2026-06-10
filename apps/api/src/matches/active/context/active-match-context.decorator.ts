import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common';
import { RequireDomainContext } from '../../../platform/domain-context/domain-context.decorator.js';
import type { ActiveMatchParticipantContextRequirement } from '../../context/active-match-context-requirement.js';
import { ActiveMatchContextGuard } from './active-match-context.guard.js';
import {
  getActiveMatchContext,
  type ActiveMatchContextRequest,
} from './active-match-context.types.js';

export type ActiveMatchParticipantFailureMode = ActiveMatchParticipantContextRequirement['failure'];

export function RequireActiveMatchParticipant(
  failure: ActiveMatchParticipantFailureMode = 'unmatch-request-not-allowed',
) {
  return applyDecorators(
    RequireDomainContext({
      kind: 'active-match-participant',
      mode: 'require-existing',
      param: 'id',
      failure,
    }),
    UseGuards(ActiveMatchContextGuard),
  );
}

export const ActiveMatchContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<ActiveMatchContextRequest>();
    const activeMatch = getActiveMatchContext(request);
    if (!activeMatch) {
      throw new Error('[ActiveMatchContext] guard must run before decorator');
    }

    return activeMatch;
  },
);
