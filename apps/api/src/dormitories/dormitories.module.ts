import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DormitoriesController } from './dormitories.controller.js';
import { DormitoriesService } from './dormitories.service.js';
import { DormitorySelectableQueryService } from './dormitory-selectable-query.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [DormitoriesController],
  providers: [DormitoriesService, DormitorySelectableQueryService],
  exports: [DormitoriesService],
})
export class DormitoriesModule {}
