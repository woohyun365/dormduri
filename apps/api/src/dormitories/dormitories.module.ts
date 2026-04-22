import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { DormitoriesController } from './dormitories.controller.js';
import { DormitoriesService } from './dormitories.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule],
  controllers: [DormitoriesController],
  providers: [DormitoriesService],
  exports: [DormitoriesService],
})
export class DormitoriesModule {}
