import type { Provider } from '@nestjs/common';
import { DormitoriesService } from '../application/dormitories.service.js';
import { DormitoryCatalogQuery } from '../catalog/dormitory-catalog.query.js';
import { DormitoryCatalogRepository } from '../catalog/dormitory-catalog.repository.js';
import { DORMITORY_SELECTION_CATALOG_PORT } from '../selection-catalog/dormitory-selection-catalog.port.js';
import { PrismaDormitorySelectionCatalogAdapter } from '../selection-catalog/prisma-dormitory-selection-catalog.adapter.js';

export const DORMITORIES_PROVIDERS: Provider[] = [
  DormitoriesService,
  DormitoryCatalogRepository,
  DormitoryCatalogQuery,
  PrismaDormitorySelectionCatalogAdapter,
  {
    provide: DORMITORY_SELECTION_CATALOG_PORT,
    useExisting: PrismaDormitorySelectionCatalogAdapter,
  },
];
