import { Injectable } from '@nestjs/common';
import type { DeleteBlockResponse } from '@repo/shared/social-safety/block';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { BlockPresenter } from '../presenters/block.presenter.js';
import { BlockRepository } from '../repositories/block.repository.js';

@Injectable()
export class DeleteBlockCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BlockRepository,
    private readonly presenter: BlockPresenter,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    targetUserId: string;
  }): Promise<DeleteBlockResponse> {
    const now = await this.prisma.getDatabaseNow();

    const deleted = await this.prisma.runSerializableTransaction(async (tx) => {
      const active = await this.repository.findActiveBetween({
        client: tx,
        blockerUserId: input.authUser.id,
        blockedUserId: input.targetUserId,
      });
      if (!active) {
        return false;
      }

      const unblocked = await this.repository.markUnblocked({
        client: tx,
        blockId: active.id,
        now,
      });
      await this.repository.appendUnblockedEvent({ client: tx, block: unblocked, now });
      return true;
    });

    return this.presenter.toDeleteResponse({ deleted, now });
  }
}
