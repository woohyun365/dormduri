import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DormitoryCatalogQuery } from './catalog/dormitory-catalog.query.js';
import { DormitoryCatalogRepository } from './catalog/dormitory-catalog.repository.js';
import { DormitoriesController } from './dormitories.controller.js';
import { DormitoriesService } from './dormitories.service.js';
import { DormitoryGuideQuery } from './guides/dormitory-guide.query.js';
import { DORMITORY_SELECTION_CATALOG_PORT } from './selection-catalog/dormitory-selection-catalog.port.js';
import { PrismaDormitorySelectionCatalogAdapter } from './selection-catalog/prisma-dormitory-selection-catalog.adapter.js';

@Module({
  imports: [PrismaModule],
  controllers: [DormitoriesController],
  providers: [
    DormitoriesService,
    DormitoryCatalogRepository,
    DormitoryCatalogQuery,
    DormitoryGuideQuery,
    PrismaDormitorySelectionCatalogAdapter,
    {
      provide: DORMITORY_SELECTION_CATALOG_PORT,
      useExisting: PrismaDormitorySelectionCatalogAdapter,
    },
  ],
  exports: [DormitoriesService, DORMITORY_SELECTION_CATALOG_PORT],
})
export class DormitoriesModule {}
