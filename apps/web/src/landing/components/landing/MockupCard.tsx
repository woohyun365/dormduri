import { Badge } from './Badge';

interface MockupCardProps {
  variant: 'profile' | 'banner';
}

export function MockupCard({ variant }: MockupCardProps) {
  if (variant === 'banner') {
    return (
      <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-900">비시즌: 열람만 가능</p>
          <span className="text-sm font-semibold text-blue-600">시즌 안내</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-[var(--knu-border)] rounded-2xl p-5 shadow-md hover:shadow-xl transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-[var(--knu-text-primary)] mb-2">조용한밤하늘</h4>
          <div className="flex gap-2">
            <Badge variant="default">비흡연</Badge>
            <Badge variant="default">2인실</Badge>
          </div>
        </div>
        <div className="w-5 h-5 rounded-full bg-gray-200"></div>
      </div>

      <div className="space-y-2 text-sm mb-3">
        <div className="flex items-center">
          <span className="text-[var(--knu-text-secondary)] w-20">수면시간</span>
          <span className="text-[var(--knu-text-primary)] font-semibold">23:00 ~ 07:00</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <span className="text-[var(--knu-text-secondary)] mr-2">소음</span>
            <Badge variant="secondary">4</Badge>
          </div>
          <div className="flex items-center">
            <span className="text-[var(--knu-text-secondary)] mr-2">청결</span>
            <Badge variant="secondary">5</Badge>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--knu-border)]">
        <span className="text-xs text-[var(--knu-text-tertiary)]">프로필 보기</span>
      </div>
    </div>
  );
}
