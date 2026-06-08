import { Module } from '@nestjs/common';
import { BlockModule } from './blocks/block.module.js';
import { BookmarkModule } from './bookmarks/bookmark.module.js';

@Module({
  imports: [BookmarkModule, BlockModule],
  exports: [BookmarkModule, BlockModule],
})
export class SocialSafetyModule {}
