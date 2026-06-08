import { Module } from '@nestjs/common';
import { ChatModule } from '../../chat/chat.module.js';
import { MatchesModule } from '../../matches/matches.module.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { SeasonParticipantsModule } from '../../season-participants/season-participants.module.js';
import { SeasonsModule } from '../../seasons/seasons.module.js';
import { BookmarkModule } from '../bookmarks/bookmark.module.js';
import { BookmarkRepository } from '../bookmarks/repositories/bookmark.repository.js';
import { BlockService } from './application/block.service.js';
import { BlockController } from './block.controller.js';
import { CreateBlockCommand } from './commands/create-block.command.js';
import { DeleteBlockCommand } from './commands/delete-block.command.js';
import { BlockTargetPolicyEvaluator } from './policies/block-target-policy.evaluator.js';
import { BlockPresenter } from './presenters/block.presenter.js';
import { BlockListQuery } from './queries/block-list.query.js';
import { BlockRepository } from './repositories/block.repository.js';
import { BlockSideEffectService } from './side-effects/block-side-effect.service.js';

@Module({
  imports: [
    PrismaModule,
    SeasonsModule,
    SeasonParticipantsModule,
    BookmarkModule,
    MatchesModule,
    ChatModule,
  ],
  controllers: [BlockController],
  providers: [
    BlockService,
    CreateBlockCommand,
    DeleteBlockCommand,
    BlockListQuery,
    BlockTargetPolicyEvaluator,
    BlockRepository,
    BookmarkRepository,
    BlockPresenter,
    BlockSideEffectService,
  ],
  exports: [BlockService],
})
export class BlockModule {}
