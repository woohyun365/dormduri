import { Module } from '@nestjs/common';
import { BlockModule } from './blocks/block.module.js';
import { BookmarkModule } from './bookmarks/bookmark.module.js';
import { EnforcementNoticeModule } from './enforcements/enforcement-notice.module.js';
import { ReportModule } from './reports/report.module.js';

@Module({
  imports: [BookmarkModule, BlockModule, ReportModule, EnforcementNoticeModule],
  exports: [BookmarkModule, BlockModule, ReportModule, EnforcementNoticeModule],
})
export class SocialSafetyModule {}
