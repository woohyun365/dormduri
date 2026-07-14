import { Injectable } from '@nestjs/common';
import type {
  EnforcementNoticeListResponse,
  ListEnforcementNoticesQuery,
} from '@repo/shared/social-safety/enforcement';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { EnforcementNoticePresenter } from '../presenters/enforcement-notice.presenter.js';
import { EnforcementNoticeRepository } from '../repositories/enforcement-notice.repository.js';
import { decodeEnforcementNoticeListCursor } from './enforcement-notice-list.cursor.js';

@Injectable()
export class EnforcementNoticeListQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: EnforcementNoticeRepository,
    private readonly presenter: EnforcementNoticePresenter,
  ) {}

  async listOwn(
    authUser: AuthenticatedUserContext,
    query: ListEnforcementNoticesQuery,
  ): Promise<EnforcementNoticeListResponse> {
    const [now, records] = await Promise.all([
      this.prisma.getDatabaseNow(),
      this.repository.findForUser({
        userId: authUser.id,
        cursor: decodeEnforcementNoticeListCursor(query.cursor),
        limit: query.limit,
      }),
    ]);

    return this.presenter.toListResponse({ records, limit: query.limit, now });
  }
}
