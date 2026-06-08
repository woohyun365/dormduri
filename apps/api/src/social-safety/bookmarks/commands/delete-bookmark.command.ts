import { Injectable } from '@nestjs/common';
import type { DeleteBookmarkResponse } from '@repo/shared/social-safety/bookmark';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { BookmarkPresenter } from '../presenters/bookmark.presenter.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { BookmarkTargetPolicyEvaluator } from '../policies/bookmark-target-policy.evaluator.js';

@Injectable()
export class DeleteBookmarkCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BookmarkRepository,
    private readonly targetPolicyEvaluator: BookmarkTargetPolicyEvaluator,
    private readonly presenter: BookmarkPresenter,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    targetUserId: string;
  }): Promise<DeleteBookmarkResponse> {
    const now = await this.prisma.getDatabaseNow();
    const viewerContext = await this.targetPolicyEvaluator.loadViewerContext(input.authUser, now);
    if (!viewerContext.currentSeasonId) {
      return this.presenter.toDeleteResponse({ deleted: false, now });
    }

    return this.prisma.runSerializableTransaction(async (tx) => {
      const deleted = await this.repository.softDeleteActiveByTargetUser({
        client: tx,
        viewerUserId: input.authUser.id,
        seasonId: viewerContext.currentSeasonId ?? '',
        targetUserId: input.targetUserId,
        now,
      });

      return this.presenter.toDeleteResponse({ deleted, now });
    });
  }
}
