import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  createBookmarkRequestSchema,
  deleteBookmarkRequestSchema,
  listBookmarksQuerySchema,
} from '@repo/shared/social-safety/bookmark';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parsePathParam, parseQueryObject } from '../../platform/http/zod-request.js';
import { BookmarkService } from './application/bookmark.service.js';

@Controller('api/bookmarks')
@RequireCapability()
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Get()
  async list(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseQueryObject(listBookmarksQuerySchema, query, {
      code: 'INVALID_BOOKMARK_QUERY',
      errorMessage: '북마크 목록 요청이 올바르지 않습니다.',
    });
    return this.bookmarkService.list(authUser, parsed);
  }

  @Post(':targetUserId')
  async create(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('targetUserId') targetUserId: string,
  ) {
    const parsed = parsePathParam(createBookmarkRequestSchema.shape.targetUserId, targetUserId, {
      code: 'INVALID_BOOKMARK_TARGET',
      errorMessage: '북마크 대상이 올바르지 않습니다.',
      fieldName: 'targetUserId',
    });
    return this.bookmarkService.create(authUser, parsed);
  }

  @Delete(':targetUserId')
  async delete(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('targetUserId') targetUserId: string,
  ) {
    const parsed = parsePathParam(deleteBookmarkRequestSchema.shape.targetUserId, targetUserId, {
      code: 'INVALID_BOOKMARK_TARGET',
      errorMessage: '북마크 대상이 올바르지 않습니다.',
      fieldName: 'targetUserId',
    });
    return this.bookmarkService.delete(authUser, parsed);
  }
}
