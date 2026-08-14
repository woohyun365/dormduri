import { Controller, Get, Param, Query } from '@nestjs/common';
import { globalNoticeIdSchema, listGlobalNoticesQuerySchema } from '@repo/shared/notices';
import { Public } from '../auth/access/auth-access.decorator.js';
import { parsePathParam, parseQueryObject } from '../platform/http/zod-request.js';
import { NoticesService } from './application/notices.service.js';

@Controller('api/notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Public()
  @Get()
  listGlobalNotices(@Query() query: Record<string, unknown>) {
    const parsed = parseQueryObject(listGlobalNoticesQuerySchema, query, {
      code: 'INVALID_GLOBAL_NOTICE_QUERY',
      errorMessage: '공지사항 목록 요청이 올바르지 않습니다.',
    });
    return this.noticesService.listGlobalNotices(parsed);
  }

  @Public()
  @Get(':noticeId')
  getGlobalNotice(@Param('noticeId') noticeId: string) {
    const parsed = parsePathParam(globalNoticeIdSchema, noticeId, {
      code: 'INVALID_GLOBAL_NOTICE_ID',
      errorMessage: '공지사항 식별자가 올바르지 않습니다.',
      fieldName: 'noticeId',
    });
    return this.noticesService.getGlobalNotice(parsed);
  }
}
