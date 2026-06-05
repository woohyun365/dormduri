import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DORMITORIES_EXPORTS } from './composition/dormitories.exports.js';
import { DORMITORIES_PROVIDERS } from './composition/dormitories.providers.js';
import { DormitoriesController } from './dormitories.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [DormitoriesController],
  providers: DORMITORIES_PROVIDERS,
  exports: DORMITORIES_EXPORTS,
})
export class DormitoriesModule {}
