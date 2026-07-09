import { Injectable } from '@nestjs/common';
import type { ListEnforcementNoticesQuery } from '@repo/shared/social-safety/enforcement';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { EnforcementNoticeListQuery } from '../queries/enforcement-notice-list.query.js';

@Injectable()
export class EnforcementNoticeService {
  constructor(private readonly noticeListQuery: EnforcementNoticeListQuery) {}

  listOwn(authUser: AuthenticatedUserContext, query: ListEnforcementNoticesQuery) {
    return this.noticeListQuery.listOwn(authUser, query);
  }
}
