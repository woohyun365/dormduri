import { dormitoryListResponseSchema } from '@repo/shared/dormitory';
import type { NextRequest } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';

export async function GET(request: NextRequest) {
  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path: `/api/dormitories${request.nextUrl.search}`,
    operation: 'dormitory.list',
    responseSchema: dormitoryListResponseSchema,
  });
}
