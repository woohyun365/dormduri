import { Inject, Injectable } from '@nestjs/common';
import type {
  RoommateSearchManifestQuery,
  RoommateSearchManifestResponse,
  RoommateSearchQuery,
  RoommateSearchResponse,
} from '@repo/shared/roommate-search/contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  BLOCK_VISIBILITY_READER_PORT,
  type BlockVisibilityReaderPort,
} from '../../social-safety/blocks/application/ports/block-visibility-reader.port.js';
import {
  BOOKMARK_SEARCH_METADATA_READER_PORT,
  type BookmarkSearchMetadataReaderPort,
} from '../../social-safety/bookmarks/application/ports/bookmark-search-metadata-reader.port.js';
import {
  PROFILE_PUBLIC_TARGET_READER_PORT,
  type ProfilePublicTargetReaderPort,
} from '../../profiles/contracts/profile-public-target-reader.port.js';
import { createRoommateSearchReader } from '../integration/roommate-search.reader.js';

@Injectable()
export class RoommateSearchService {
  private readonly reader;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROFILE_PUBLIC_TARGET_READER_PORT)
    private readonly publicProfileTargetReader: ProfilePublicTargetReaderPort,
    @Inject(BOOKMARK_SEARCH_METADATA_READER_PORT)
    private readonly bookmarkSearchMetadataReader: BookmarkSearchMetadataReaderPort,
    @Inject(BLOCK_VISIBILITY_READER_PORT)
    private readonly blockVisibilityReader: BlockVisibilityReaderPort,
  ) {
    this.reader = createRoommateSearchReader({
      prisma: this.prisma,
      publicProfileTargetReader: this.publicProfileTargetReader,
      bookmarkSearchMetadataReader: this.bookmarkSearchMetadataReader,
      blockVisibilityReader: this.blockVisibilityReader,
    });
  }

  async search(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchQuery,
  ): Promise<RoommateSearchResponse> {
    return this.reader.search(authUser, query);
  }

  async getManifest(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchManifestQuery,
  ): Promise<RoommateSearchManifestResponse> {
    return this.reader.getManifest(authUser, query);
  }
}
