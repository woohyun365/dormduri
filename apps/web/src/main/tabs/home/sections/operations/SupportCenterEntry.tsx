import type { Route } from 'next';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

export function SupportCenterEntry() {
  return (
    <Link
      href={'/support' as Route}
      className="block rounded-2xl border border-emerald-100 bg-emerald-50/45 p-3 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <LifeBuoy className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-(--knu-text-primary)">문의하기</span>
            <span className="block text-[11px] text-(--knu-text-tertiary)">
              FAQ와 내 문의 내역을 확인해요.
            </span>
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-extrabold text-emerald-700">바로가기</span>
      </span>
    </Link>
  );
}
