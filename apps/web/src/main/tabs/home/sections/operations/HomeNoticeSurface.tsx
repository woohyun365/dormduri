import type { Route } from 'next';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';

export function HomeNoticeSurface() {
  return (
    <section aria-label="공지사항" className="overflow-hidden rounded-3xl">
      <Link
        href={'/notices' as Route}
        className="group block w-full rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-4 text-left shadow-sm transition-colors hover:border-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary) md:p-5"
      >
        <span className="flex items-start gap-3 md:items-center md:gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 md:size-11">
            <Megaphone className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
              운영 안내
            </span>
            <span className="mt-2 block text-sm font-extrabold leading-snug text-(--knu-text-primary) md:text-base">
              공지사항을 확인해요
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-(--knu-text-secondary) md:text-sm">
              시즌 일정과 서비스 안내 등을 확인할 수 있어요.
            </span>
          </span>
          <span className="hidden shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-(--knu-primary) shadow-sm transition-colors group-hover:bg-white md:inline-flex">
            전체 보기
          </span>
        </span>
      </Link>
    </section>
  );
}
