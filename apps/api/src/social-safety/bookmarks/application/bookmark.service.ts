import { Injectable } from '@nestjs/common';
import type {
  BookmarkListResponse,
  CreateBookmarkResponse,
  DeleteBookmarkResponse,
  ListBookmarksQuery,
} from '@repo/shared/social-safety/bookmark';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { BookmarkListQuery } from '../queries/bookmark-list.query.js';
import { CreateBookmarkCommand } from '../commands/create-bookmark.command.js';
import { DeleteBookmarkCommand } from '../commands/delete-bookmark.command.js';

@Injectable()
export class BookmarkService {
  constructor(
    private readonly createBookmarkCommand: CreateBookmarkCommand,
    private readonly deleteBookmarkCommand: DeleteBookmarkCommand,
    private readonly bookmarkListQuery: BookmarkListQuery,
  ) {}

  create(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
  ): Promise<CreateBookmarkResponse> {
    return this.createBookmarkCommand.execute({ authUser, targetUserId });
  }

  delete(
    authUser: AuthenticatedUserContext,
    targetUserId: string,
  ): Promise<DeleteBookmarkResponse> {
    return this.deleteBookmarkCommand.execute({ authUser, targetUserId });
  }

  list(
    authUser: AuthenticatedUserContext,
    query: ListBookmarksQuery,
  ): Promise<BookmarkListResponse> {
    return this.bookmarkListQuery.execute({ authUser, query });
  }
}
