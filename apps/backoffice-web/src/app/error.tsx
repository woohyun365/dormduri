'use client';

import { Button } from '@/ui/forms';

/** `retry()` reads the server components again (Next.js 16.3+); `reset()` would only re-render. */
export default function BackofficeError({ retry }: { readonly retry: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-slate-900">화면을 불러오지 못했습니다</h1>
      <p className="text-sm text-slate-700">
        백오피스 API에 닿지 못했거나 응답을 읽지 못했습니다. 포트 포워딩이 열려 있는지 확인하고 다시
        시도하세요.
      </p>
      <Button onClick={() => retry()}>다시 시도</Button>
    </main>
  );
}
