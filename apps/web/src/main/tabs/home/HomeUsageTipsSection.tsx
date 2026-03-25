import { TrendingUp, BookOpen, ChevronRight } from 'lucide-react';
import { useSeasonContext } from '@/contexts/SeasonContext';

interface HomeUsageTipsSectionProps {
  onShowGuide?: () => void;
}

export function HomeUsageTipsSection({ onShowGuide }: HomeUsageTipsSectionProps) {
  const { isOpen, isMatching } = useSeasonContext();
  const seasonActive = isOpen || isMatching;
  return (
    <div>
      <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">이용 팁</h2>
      <div className="bg-gradient-to-br from-[var(--knu-primary)] to-[var(--knu-primary-hover)] rounded-2xl p-5 text-white">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold mb-2">
              {seasonActive
                ? '시즌 중에 적극적으로 활동하세요'
                : '비시즌에도 프로필을 완성해두세요'}
            </h3>
            <p className="text-sm opacity-90">
              {seasonActive
                ? '호실 선택일 전에 룸메이트를 확정하면 함께 같은 방을 선택할 수 있어요. 생활패턴이 비슷한 룸메를 찾아보세요!'
                : '시즌이 시작되면 바로 매칭을 시작할 수 있도록 미리 프로필을 완성해두세요.'}
            </p>
          </div>
        </div>
      </div>

      {onShowGuide && (
        <button
          onClick={onShowGuide}
          className="mt-3 w-full flex items-center gap-3 bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 hover:border-[var(--knu-primary)] hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
              기숙사 생활 가이드
            </p>
            <p className="text-xs text-[var(--knu-text-tertiary)]">규정, 편의시설, 연락처 확인</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
        </button>
      )}
    </div>
  );
}
