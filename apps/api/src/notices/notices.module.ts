import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { NoticesController } from './notices.controller.js';
import { NoticesService } from './notices.service.js';
import { GlobalNoticeQuery } from './queries/global-notice.query.js';
import { GlobalNoticeRepository } from './repositories/global-notice.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [NoticesController],
  providers: [NoticesService, GlobalNoticeQuery, GlobalNoticeRepository],
})
export class NoticesModule {}
