'use client';

import { useSearchParams } from 'next/navigation';
import { normalizeLoginRedirectTarget } from '../model/login-redirect-target';

export function useLoginRedirectTarget(): string {
  const searchParams = useSearchParams();
  return normalizeLoginRedirectTarget(searchParams.get('next'));
}
