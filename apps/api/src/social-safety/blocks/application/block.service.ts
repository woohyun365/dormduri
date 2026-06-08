import { Injectable } from '@nestjs/common';
import type {
  BlockListResponse,
  CreateBlockRequest,
  CreateBlockResponse,
  DeleteBlockResponse,
  ListBlocksQuery,
} from '@repo/shared/social-safety/block';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { CreateBlockCommand } from '../commands/create-block.command.js';
import { DeleteBlockCommand } from '../commands/delete-block.command.js';
import { BlockListQuery } from '../queries/block-list.query.js';

@Injectable()
export class BlockService {
  constructor(
    private readonly createBlockCommand: CreateBlockCommand,
    private readonly deleteBlockCommand: DeleteBlockCommand,
    private readonly blockListQuery: BlockListQuery,
  ) {}

  create(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
    request: CreateBlockRequest,
  ): Promise<CreateBlockResponse> {
    return this.createBlockCommand.execute({
      authUser,
      targetUserId,
      note: request.note ?? null,
    });
  }

  delete(authUser: AuthenticatedUserContext, targetUserId: string): Promise<DeleteBlockResponse> {
    return this.deleteBlockCommand.execute({ authUser, targetUserId });
  }

  list(authUser: AuthenticatedUserContext, query: ListBlocksQuery): Promise<BlockListResponse> {
    return this.blockListQuery.execute({ authUser, query });
  }
}
