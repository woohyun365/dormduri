import { Module } from '@nestjs/common';
import { ChatModule } from '../../chat/chat.module.js';
import { NotificationsModule } from '../../notifications/notifications.module.js';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { BlockModule } from '../blocks/block.module.js';
import { ReportIntakeService } from './application/report-intake.service.js';
import { CreateReportCommand } from './commands/create-report.command.js';
import { ReportNotificationService } from './notifications/report-notification.service.js';
import { ReportPresenter } from './presenters/report.presenter.js';
import { ReportRepository } from './repositories/report.repository.js';
import { ReportTargetContextResolver } from './resolvers/report-target-context.resolver.js';
import { ReportRetentionReferenceService } from './retention/report-retention-reference.service.js';
import { ReportController } from './report.controller.js';

@Module({
  imports: [PrismaModule, NotificationsModule, BlockModule, ChatModule],
  controllers: [ReportController],
  providers: [
    ReportIntakeService,
    CreateReportCommand,
    ReportTargetContextResolver,
    ReportRepository,
    ReportNotificationService,
    ReportRetentionReferenceService,
    ReportPresenter,
  ],
})
export class ReportModule {}
