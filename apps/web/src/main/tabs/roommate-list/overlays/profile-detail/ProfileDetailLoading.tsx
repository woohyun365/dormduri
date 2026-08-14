import { Skeleton } from '@/main/components/feedback/Skeleton';

export function DetailLoading({ nickname }: { readonly nickname: string }) {
  return (
    <div
      role="status"
      aria-label={`${nickname} 프로필 상세를 불러오는 중`}
      data-testid="roommate-detail-loading-skeleton"
      className="space-y-5"
    >
      <ProfileDetailHeroSkeleton />
      <ProfileDetailCompatibilitySkeleton />
      <ProfileDetailActionSkeleton />
    </div>
  );
}

function ProfileDetailHeroSkeleton() {
  return (
    <section className="overflow-hidden rounded-4xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm backdrop-blur lg:p-6">
      <div className="mb-4 space-y-2">
        <Skeleton width="72px" height="12px" className="rounded-full! bg-blue-100!" />
        <Skeleton width="128px" height="20px" className="rounded-full! bg-white/80!" />
      </div>

      <div className="space-y-3">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur lg:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton width="40px" height="40px" className="shrink-0 rounded-full! bg-blue-100!" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton width="56px" height="12px" className="rounded-full!" />
              <Skeleton width="min(220px, 70%)" height="28px" className="rounded-full!" />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {['캠퍼스', '기숙사', '나이'].map((label) => (
              <div
                key={label}
                className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm"
              >
                <Skeleton width="44px" height="10px" className="mb-2 rounded-full!" />
                <Skeleton width="80%" height="16px" className="rounded-full!" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm"
            >
              <Skeleton width="96px" height="12px" className="rounded-full!" />
              <Skeleton width="72%" height="18px" className="mt-3 rounded-full!" />
            </div>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-sm lg:p-5">
          <Skeleton width="72px" height="14px" className="mb-3 rounded-full!" />
          <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3">
            <Skeleton width="100%" height="14px" className="rounded-full! bg-blue-100!" />
            <Skeleton width="86%" height="14px" className="mt-2 rounded-full! bg-blue-100!" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileDetailCompatibilitySkeleton() {
  return (
    <section className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-4">
      <div className="space-y-2">
        <Skeleton width="88px" height="12px" className="rounded-full! bg-indigo-100!" />
        <Skeleton width="180px" height="20px" className="rounded-full!" />
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="74px" height="24px" className="rounded-full!" />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4">
        <div className="flex items-start gap-3">
          <Skeleton width="36px" height="36px" className="shrink-0 rounded-full! bg-white!" />
          <div className="flex-1 space-y-2">
            <Skeleton width="72px" height="12px" className="rounded-full!" />
            <Skeleton width="150px" height="18px" className="rounded-full!" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="rounded-2xl border border-white/80 bg-white/80 p-3">
              <Skeleton width="45%" height="12px" className="rounded-full!" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[0, 1, 2].map((chip) => (
                  <Skeleton key={chip} width="56px" height="22px" className="rounded-full!" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-4">
        <div className="mx-auto aspect-square max-w-[320px] rounded-full border border-sky-100 bg-white/80 p-8">
          <Skeleton width="100%" height="100%" className="rounded-full! bg-sky-100/80!" />
        </div>
      </div>

      <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-4">
        <Skeleton width="96px" height="18px" className="rounded-full!" />
        <div className="mt-4 grid gap-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton width="42%" height="16px" className="rounded-full!" />
                <Skeleton width="64px" height="24px" className="rounded-full!" />
              </div>
              <Skeleton width="100%" height="8px" className="mt-3 rounded-full!" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Skeleton width="100%" height="76px" className="rounded-2xl!" />
                <Skeleton width="100%" height="76px" className="rounded-2xl!" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileDetailActionSkeleton() {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-4">
      <Skeleton width="120px" height="16px" className="rounded-full!" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Skeleton width="100%" height="44px" className="rounded-2xl!" />
        <Skeleton width="100%" height="44px" className="rounded-2xl!" />
      </div>
    </section>
  );
}
