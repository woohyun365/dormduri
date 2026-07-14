import { Controller, Get, Query } from '@nestjs/common';
import { listEnforcementNoticesQuerySchema } from '@repo/shared/social-safety/enforcement';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parseQueryObject } from '../../platform/http/zod-request.js';
import { EnforcementNoticeService } from './application/enforcement-notice.service.js';

@Controller('api/enforcements')
@RequireCapability()
export class EnforcementNoticeController {
  constructor(private readonly service: EnforcementNoticeService) {}

  @Get()
  listOwn(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseQueryObject(listEnforcementNoticesQuerySchema, query, {
      code: 'INVALID_ENFORCEMENT_NOTICE_LIST_QUERY',
      errorMessage: '이용 제한 내역 요청이 올바르지 않습니다.',
    });
    return this.service.listOwn(authUser, parsed);
  }
}
