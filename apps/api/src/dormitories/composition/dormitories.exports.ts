import { DormitoriesService } from '../application/dormitories.service.js';
import { DORMITORY_SELECTION_CATALOG_PORT } from '../selection-catalog/dormitory-selection-catalog.port.js';

export const DORMITORIES_EXPORTS = [DormitoriesService, DORMITORY_SELECTION_CATALOG_PORT];
