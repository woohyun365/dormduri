import { Module } from '@nestjs/common';
import { BookmarkModule } from './bookmarks/bookmark.module.js';

@Module({
  imports: [BookmarkModule],
  exports: [BookmarkModule],
})
export class SocialSafetyModule {}
