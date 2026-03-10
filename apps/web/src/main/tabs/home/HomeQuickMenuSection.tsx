import { Users, Inbox } from 'lucide-react';

interface HomeQuickMenuSectionProps {
  onNavigateList: () => void;
  onScrollToMatch: () => void;
  receivedPendingCount: number;
}

export function HomeQuickMenuSection({
  onNavigateList,
  onScrollToMatch,
  receivedPendingCount,
}: HomeQuickMenuSectionProps) {
  return (
    <div>
      <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">빠른 메뉴</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNavigateList}
          className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 hover:border-[var(--knu-primary)] hover:shadow-sm transition-all text-left"
        >
          <div className="w-12 h-12 bg-[var(--knu-primary-light)] rounded-xl flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-[var(--knu-primary)]" />
          </div>
          <h3 className="font-bold text-[var(--knu-text-primary)] mb-1">룸메 찾기</h3>
          <p className="text-xs text-[var(--knu-text-tertiary)]">프로필 탐색하기</p>
        </button>

        <button
          onClick={onScrollToMatch}
          className="relative bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 hover:border-orange-400 hover:shadow-sm transition-all text-left"
        >
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="font-bold text-[var(--knu-text-primary)] mb-1">받은 요청</h3>
          <p className="text-xs text-[var(--knu-text-tertiary)]">매칭 요청 확인</p>
          {receivedPendingCount > 0 && (
            <span className="absolute top-3 right-3 min-w-[22px] h-[22px] flex items-center justify-center px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
              {receivedPendingCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
