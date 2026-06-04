import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { AuthOperationsModule } from '../auth/operations/auth-operations.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [PrismaModule, ChatModule, AuthOperationsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
