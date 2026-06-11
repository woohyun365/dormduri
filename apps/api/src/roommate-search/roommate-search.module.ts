import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { BlockModule } from '../social-safety/blocks/block.module.js';
import { BookmarkModule } from '../social-safety/bookmarks/bookmark.module.js';
import { ROOMMATE_SEARCH_EXPORTS } from './composition/roommate-search.exports.js';
import { ROOMMATE_SEARCH_PROVIDERS } from './composition/roommate-search.providers.js';
import { RoommateSearchController } from './roommate-search.controller.js';

@Module({
  imports: [PrismaModule, AuthModule, ProfilesModule, BookmarkModule, BlockModule],
  controllers: [RoommateSearchController],
  providers: ROOMMATE_SEARCH_PROVIDERS,
  exports: ROOMMATE_SEARCH_EXPORTS,
})
export class RoommateSearchModule {}
