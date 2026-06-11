import { Module } from '@nestjs/common';
import { BlockModule } from './blocks/block.module.js';
import { BookmarkModule } from './bookmarks/bookmark.module.js';
import { ReportModule } from './reports/report.module.js';

@Module({
  imports: [BookmarkModule, BlockModule, ReportModule],
  exports: [BookmarkModule, BlockModule, ReportModule],
})
export class SocialSafetyModule {}
