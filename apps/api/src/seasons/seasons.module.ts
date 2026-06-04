import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsController } from './seasons.controller.js';
import { SeasonsService } from './seasons.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SeasonsController],
  providers: [SeasonsService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
