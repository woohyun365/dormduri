import type { ReactNode } from 'react';
import type { RoommateSearchNoticeModel } from '../../model/search/roommateSearchNotices';

interface RoommateSearchHeaderProps {
  readonly title: string;
  readonly statusMessage: string | null;
  readonly notices: readonly RoommateSearchNoticeModel[];
  readonly showRuntimeMessages: boolean;
  readonly children?: ReactNode;
}

export function RoommateSearchHeader({
  title,
  statusMessage,
  notices,
  showRuntimeMessages,
  children,
}: RoommateSearchHeaderProps) {
  return (
    <section
      role="banner"
      className="sticky top-0 z-40 border-b-2 border-[var(--knu-border)] bg-white px-5 py-4"
    >
      <div className="mx-auto max-w-md space-y-4">
        <div>
          <p className="text-xs font-semibold text-[var(--knu-primary)]">Roommate Search</p>
          <h1 className="text-2xl font-bold text-[var(--knu-text-primary)]">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--knu-text-secondary)]">
            시즌 정책에 맞춰 공개 가능한 요약 정보만 보여줘요.
          </p>
        </div>

        {showRuntimeMessages && statusMessage ? (
          <p
            role="status"
            className="rounded-2xl bg-[var(--knu-primary-light)] px-4 py-3 text-sm font-semibold text-[var(--knu-primary)]"
          >
            {statusMessage}
          </p>
        ) : null}

        {showRuntimeMessages && notices.length > 0 ? <NoticeList notices={notices} /> : null}

        {children}
      </div>
    </section>
  );
}

function NoticeList({ notices }: { readonly notices: readonly RoommateSearchNoticeModel[] }) {
  return (
    <div className="space-y-2" aria-label="룸메이트 찾기 안내">
      {notices.map((notice) => (
        <div
          key={`${notice.code}-${notice.title}`}
          aria-live={notice.liveRegion}
          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
            notice.severity === 'WARNING'
              ? 'bg-orange-50 text-orange-800'
              : 'bg-[var(--knu-primary-light)] text-[var(--knu-primary)]'
          }`}
        >
          <p className="font-semibold">{notice.title}</p>
          <p className="text-xs opacity-90">{notice.message}</p>
        </div>
      ))}
    </div>
  );
}
