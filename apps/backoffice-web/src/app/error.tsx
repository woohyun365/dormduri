'use client';

import { ErrorScreen } from '@/screens/feedback/FeedbackScreens';

/** `retry()` reads the server components again (Next.js 16.3+); `reset()` would only re-render. */
export default function BackofficeError({ retry }: { readonly retry: () => void }) {
  return <ErrorScreen onRetry={() => retry()} />;
}
