import { roommateSearchResponseSchema } from '@repo/shared/roommate-search/contract';
import type { NextRequest } from 'next/server';
import {
  forwardRoommateSearchGet,
  ROOMMATE_SEARCH_ALLOWED_QUERY_KEYS,
} from './_roommate-search-bff';

export async function GET(request: NextRequest) {
  return forwardRoommateSearchGet({
    request,
    upstreamPath: '/api/roommate-search',
    allowedQueryKeys: ROOMMATE_SEARCH_ALLOWED_QUERY_KEYS,
    responseSchema: roommateSearchResponseSchema,
  });
}
