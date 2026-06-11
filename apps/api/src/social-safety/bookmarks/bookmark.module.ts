import { Module } from '@nestjs/common';
import { MatchesModule } from '../../matches/matches.module.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { SeasonParticipantsModule } from '../../season-participants/season-participants.module.js';
import { SeasonsModule } from '../../seasons/seasons.module.js';
import { BookmarkLifecycleService } from './application/bookmark-lifecycle.service.js';
import { BookmarkService } from './application/bookmark.service.js';
import { BookmarkController } from './bookmark.controller.js';
import { CreateBookmarkCommand } from './commands/create-bookmark.command.js';
import { DeleteBookmarkCommand } from './commands/delete-bookmark.command.js';
import { BookmarkTargetPolicyEvaluator } from './policies/bookmark-target-policy.evaluator.js';
import { BookmarkPresenter } from './presenters/bookmark.presenter.js';
import { BookmarkListQuery } from './queries/bookmark-list.query.js';
import { BookmarkRepository } from './repositories/bookmark.repository.js';

@Module({
  imports: [PrismaModule, SeasonsModule, SeasonParticipantsModule, MatchesModule],
  controllers: [BookmarkController],
  providers: [
    BookmarkService,
    BookmarkLifecycleService,
    CreateBookmarkCommand,
    DeleteBookmarkCommand,
    BookmarkListQuery,
    BookmarkTargetPolicyEvaluator,
    BookmarkRepository,
    BookmarkPresenter,
  ],
  exports: [BookmarkLifecycleService],
})
export class BookmarkModule {}
