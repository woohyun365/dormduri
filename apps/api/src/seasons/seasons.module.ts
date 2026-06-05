import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsController } from './seasons.controller.js';
import { SeasonsService } from './seasons.service.js';
import { CurrentSeasonContextQuery } from './runtime/current-season-context.query.js';
import { DormitoryMatchWindowQuery } from './runtime/dormitory-match-window.query.js';
import { SeasonRuntimeRepository } from './runtime/season-runtime.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [SeasonsController],
  providers: [
    SeasonsService,
    SeasonRuntimeRepository,
    CurrentSeasonContextQuery,
    DormitoryMatchWindowQuery,
  ],
  exports: [SeasonsService],
})
export class SeasonsModule {}
