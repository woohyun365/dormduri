import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { roommateSearchQuerySchema } from '@repo/shared/roommate-search-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseQueryObject } from '../common/http/zod-request.js';
import { RoommateSearchService } from './roommate-search.service.js';

@Controller('api/roommate-search')
@UseGuards(AuthenticatedUserGuard)
export class RoommateSearchController {
  constructor(private readonly roommateSearchService: RoommateSearchService) {}

  @Get()
  async search(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseQueryObject(roommateSearchQuerySchema, query, {
      code: 'INVALID_ROOMMATE_SEARCH_QUERY',
      errorMessage: '룸메이트 찾기 검색 조건이 올바르지 않습니다.',
    });
    return this.roommateSearchService.search(authUser, parsed);
  }
}
