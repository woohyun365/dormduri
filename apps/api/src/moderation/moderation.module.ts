import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { ModerationRepository } from './moderation.repository.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [PrismaModule],
  providers: [ModerationRepository, ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
