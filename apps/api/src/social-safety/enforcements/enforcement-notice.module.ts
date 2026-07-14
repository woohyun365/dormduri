import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { EnforcementNoticeService } from './application/enforcement-notice.service.js';
import { EnforcementNoticeController } from './enforcement-notice.controller.js';
import { EnforcementNoticePresenter } from './presenters/enforcement-notice.presenter.js';
import { EnforcementNoticeListQuery } from './queries/enforcement-notice-list.query.js';
import { EnforcementNoticeRepository } from './repositories/enforcement-notice.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [EnforcementNoticeController],
  providers: [
    EnforcementNoticeService,
    EnforcementNoticeListQuery,
    EnforcementNoticeRepository,
    EnforcementNoticePresenter,
  ],
  exports: [EnforcementNoticeRepository],
})
export class EnforcementNoticeModule {}
