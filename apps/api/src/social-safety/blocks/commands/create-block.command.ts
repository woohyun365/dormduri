import { Injectable } from '@nestjs/common';
import type { CreateBlockResponse } from '@repo/shared/social-safety/block';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { BlockTargetPolicyEvaluator } from '../policies/block-target-policy.evaluator.js';
import { BlockPresenter } from '../presenters/block.presenter.js';
import { BlockRepository } from '../repositories/block.repository.js';
import { BlockSideEffectService } from '../side-effects/block-side-effect.service.js';

@Injectable()
export class CreateBlockCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BlockRepository,
    private readonly targetPolicyEvaluator: BlockTargetPolicyEvaluator,
    private readonly sideEffectService: BlockSideEffectService,
    private readonly presenter: BlockPresenter,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    targetUserId: string;
    note: string | null;
  }): Promise<CreateBlockResponse> {
    const now = await this.prisma.getDatabaseNow();

    try {
      return await this.prisma.runSerializableTransaction(async (tx) => {
        const target = await this.targetPolicyEvaluator.resolveCreateTarget({
          authUser: input.authUser,
          targetUserId: input.targetUserId,
          now,
          client: tx,
        });
        const active = await this.repository.findActiveBetween({
          client: tx,
          blockerUserId: input.authUser.id,
          blockedUserId: target.targetUserId,
        });
        if (active) {
          return this.presenter.toCreateResponse({ block: active, created: false, now });
        }

        const block = await this.repository.create({
          client: tx,
          blockerUserId: input.authUser.id,
          blockedUserId: target.targetUserId,
          note: input.note,
          now,
        });
        await this.repository.appendBlockedEvent({ client: tx, block, now });
        await this.sideEffectService.applyBlockCreated({
          tx,
          seasonId: target.viewerContext.seasonContext.season.id,
          blockerUserId: input.authUser.id,
          blockedUserId: target.targetUserId,
          sourceBlockId: block.id,
          now,
        });

        return this.presenter.toCreateResponse({ block, created: true, now });
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const active = await this.repository.findActiveBetween({
        blockerUserId: input.authUser.id,
        blockedUserId: input.targetUserId,
      });
      if (!active) {
        throw error;
      }

      return this.presenter.toCreateResponse({ block: active, created: false, now });
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
