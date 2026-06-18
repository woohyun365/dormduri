import type { Provider } from '@nestjs/common';
import { RoommateSearchService } from '../application/roommate-search.service.js';

export const ROOMMATE_SEARCH_PROVIDERS: Provider[] = [RoommateSearchService];
