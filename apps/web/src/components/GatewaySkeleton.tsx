'use client';

import { Skeleton } from './Skeleton';

/**
 * `/` 게이트웨이 전용 스켈레톤.
 * Landing / Main 어느 쪽으로도 과하게 치우치지 않은 중립 레이아웃만 보여준다.
 */
export function GatewaySkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--knu-border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Skeleton width="120px" height="20px" />
          <div className="flex items-center gap-3">
            <Skeleton width="72px" height="16px" />
            <Skeleton width="88px" height="36px" className="rounded-full" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10 md:py-14">
        <section className="rounded-[28px] bg-[var(--knu-background-alt)] px-6 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <Skeleton width="96px" height="14px" className="mx-auto" />
            <Skeleton width="72%" height="40px" className="mx-auto rounded-2xl" />
            <Skeleton width="54%" height="18px" className="mx-auto" />
            <div className="flex justify-center gap-3 pt-4">
              <Skeleton width="132px" height="44px" className="rounded-full" />
              <Skeleton width="132px" height="44px" className="rounded-full" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border-2 border-[var(--knu-border)] bg-white px-5 py-6"
            >
              <Skeleton width="44px" height="44px" className="mb-4 rounded-2xl" />
              <Skeleton width="60%" height="22px" className="mb-3" />
              <Skeleton width="100%" height="16px" className="mb-2" />
              <Skeleton width="82%" height="16px" />
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-[var(--knu-text-tertiary)]">
          서비스를 준비하고 있어요
        </p>
      </main>
    </div>
  );
}
