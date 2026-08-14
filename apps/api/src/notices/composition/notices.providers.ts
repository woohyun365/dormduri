import type { Provider } from '@nestjs/common';
import { NoticesService } from '../application/notices.service.js';
import { GlobalNoticeQuery } from '../queries/global-notice.query.js';
import { GlobalNoticeRepository } from '../repositories/global-notice.repository.js';

export const NOTICES_PROVIDERS: Provider[] = [
  NoticesService,
  GlobalNoticeQuery,
  GlobalNoticeRepository,
];
