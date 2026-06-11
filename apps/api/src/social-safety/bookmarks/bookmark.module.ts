import { Module } from '@nestjs/common';
import { MatchesModule } from '../../matches/matches.module.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { SeasonParticipantsModule } from '../../season-participants/season-participants.module.js';
import { SeasonsModule } from '../../seasons/seasons.module.js';
import { BookmarkLifecycleService } from './application/bookmark-lifecycle.service.js';
import { BOOKMARK_SEARCH_METADATA_READER_PORT } from './application/ports/bookmark-search-metadata-reader.port.js';
import { BookmarkService } from './application/bookmark.service.js';
import { BookmarkController } from './bookmark.controller.js';
import { CreateBookmarkCommand } from './commands/create-bookmark.command.js';
import { DeleteBookmarkCommand } from './commands/delete-bookmark.command.js';
import { BookmarkTargetPolicyEvaluator } from './policies/bookmark-target-policy.evaluator.js';
import { BookmarkPresenter } from './presenters/bookmark.presenter.js';
import { BookmarkListQuery } from './queries/bookmark-list.query.js';
import { BookmarkSearchMetadataQuery } from './queries/bookmark-search-metadata.query.js';
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
    BookmarkSearchMetadataQuery,
    {
      provide: BOOKMARK_SEARCH_METADATA_READER_PORT,
      useExisting: BookmarkSearchMetadataQuery,
    },
    BookmarkTargetPolicyEvaluator,
    BookmarkRepository,
    BookmarkPresenter,
  ],
  exports: [BookmarkLifecycleService, BOOKMARK_SEARCH_METADATA_READER_PORT],
})
export class BookmarkModule {}
