import { Injectable } from '@nestjs/common';
import type { CreateBookmarkResponse } from '@repo/shared/social-safety/bookmark';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { BookmarkPresenter } from '../presenters/bookmark.presenter.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { BookmarkTargetPolicyEvaluator } from '../policies/bookmark-target-policy.evaluator.js';

@Injectable()
export class CreateBookmarkCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BookmarkRepository,
    private readonly targetPolicyEvaluator: BookmarkTargetPolicyEvaluator,
    private readonly presenter: BookmarkPresenter,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    targetUserId: string;
  }): Promise<CreateBookmarkResponse> {
    const now = await this.prisma.getDatabaseNow();

    try {
      return await this.prisma.runSerializableTransaction(async (tx) => {
        const target = await this.targetPolicyEvaluator.resolveCreateTarget({
          authUser: input.authUser,
          targetUserId: input.targetUserId,
          now,
          client: tx,
        });
        const active = await this.repository.findActiveByParticipant({
          client: tx,
          viewerUserId: input.authUser.id,
          seasonId: target.viewerContext.currentSeasonId ?? '',
          targetParticipantId: target.targetParticipantId,
        });
        if (active) {
          return this.presenter.toCreateResponse({ bookmark: active, created: false, now });
        }

        const restorable = await this.repository.findRestorableByParticipant({
          client: tx,
          viewerUserId: input.authUser.id,
          seasonId: target.viewerContext.currentSeasonId ?? '',
          targetParticipantId: target.targetParticipantId,
        });
        const bookmark = restorable
          ? await this.repository.restore({ client: tx, bookmarkId: restorable.id, now })
          : await this.repository.create({
              client: tx,
              viewerUserId: input.authUser.id,
              seasonId: target.viewerContext.currentSeasonId ?? '',
              targetUserId: target.targetUserId,
              targetParticipantId: target.targetParticipantId,
              now,
            });

        return this.presenter.toCreateResponse({ bookmark, created: true, now });
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const target = await this.targetPolicyEvaluator.resolveCreateTarget({
        authUser: input.authUser,
        targetUserId: input.targetUserId,
        now,
      });
      const active = await this.repository.findActiveByParticipant({
        viewerUserId: input.authUser.id,
        seasonId: target.viewerContext.currentSeasonId ?? '',
        targetParticipantId: target.targetParticipantId,
      });
      if (!active) {
        throw error;
      }

      return this.presenter.toCreateResponse({ bookmark: active, created: false, now });
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
