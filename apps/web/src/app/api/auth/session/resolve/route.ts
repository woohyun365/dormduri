import type { NextRequest } from 'next/server';
import { recordAuthMutationRequestInspection, resolveBrowserSession } from '@/auth/bff';

export async function POST(request: NextRequest) {
  recordAuthMutationRequestInspection(request);
  return resolveBrowserSession(request);
}
