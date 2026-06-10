import { Injectable } from '@nestjs/common';
import type { MatchRequestActionResponse } from '@repo/shared/match/contract';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { ResolveTerminalMatchRequestCommand } from './resolve-terminal-match-request.command.js';

@Injectable()
export class CancelMatchRequestCommand {
  constructor(private readonly terminalCommand: ResolveTerminalMatchRequestCommand) {}

  execute(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.terminalCommand.execute(
      authUser,
      requestId,
      'CANCELLED_BY_REQUESTER',
      'CANCELLED_BY_REQUESTER',
    );
  }
}
