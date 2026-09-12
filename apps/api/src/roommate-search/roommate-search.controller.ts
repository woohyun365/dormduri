import { Controller, Get, Query } from '@nestjs/common';
import {
  roommateSearchManifestQuerySchema,
  roommateSearchQuerySchema,
  type RoommateSearchManifestQuery,
  type RoommateSearchQuery,
} from '@repo/shared/roommate-search/contract';
import { RequireCapability } from '../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { parseQueryObject } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import { RoommateSearchService } from './application/roommate-search.service.js';

@Controller('api/roommate-search')
@RequireCapability()
export class RoommateSearchController {
  constructor(private readonly roommateSearchService: RoommateSearchService) {}

  @Get('manifest')
  async getManifest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query(
      new ZodRequestPipe((query: unknown) =>
        parseQueryObject(roommateSearchManifestQuerySchema, query, {
          code: 'INVALID_ROOMMATE_SEARCH_QUERY',
          errorMessage: '룸메이트 찾기 manifest 요청이 올바르지 않습니다.',
        }),
      ),
    )
    parsed: RoommateSearchManifestQuery,
  ) {
    return this.roommateSearchService.getManifest(authUser, parsed);
  }

  @Get()
  async search(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query(
      new ZodRequestPipe((query: unknown) =>
        parseQueryObject(roommateSearchQuerySchema, query, {
          code: 'INVALID_ROOMMATE_SEARCH_QUERY',
          errorMessage: '룸메이트 찾기 검색 조건이 올바르지 않습니다.',
        }),
      ),
    )
    parsed: RoommateSearchQuery,
  ) {
    return this.roommateSearchService.search(authUser, parsed);
  }
}
