import { Controller, Get, Query } from '@nestjs/common';
import {
  roommateSearchManifestQuerySchema,
  roommateSearchQuerySchema,
} from '@repo/shared/roommate-search-contract';
import { RequireCapability } from '../auth/auth-access.decorator.js';
import { CurrentUser } from '../auth/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseQueryObject } from '../common/http/zod-request.js';
import { RoommateSearchService } from './roommate-search.service.js';

@Controller('api/roommate-search')
@RequireCapability()
export class RoommateSearchController {
  constructor(private readonly roommateSearchService: RoommateSearchService) {}

  @Get('manifest')
  async getManifest(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseQueryObject(roommateSearchManifestQuerySchema, query, {
      code: 'INVALID_ROOMMATE_SEARCH_QUERY',
      errorMessage: '룸메이트 찾기 manifest 요청이 올바르지 않습니다.',
    });
    return this.roommateSearchService.getManifest(authUser, parsed);
  }

  @Get()
  async search(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseQueryObject(roommateSearchQuerySchema, query, {
      code: 'INVALID_ROOMMATE_SEARCH_QUERY',
      errorMessage: '룸메이트 찾기 검색 조건이 올바르지 않습니다.',
    });
    return this.roommateSearchService.search(authUser, parsed);
  }
}
