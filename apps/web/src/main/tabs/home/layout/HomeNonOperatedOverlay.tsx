import { ShieldAlert } from 'lucide-react';

export function HomeNonOperatedOverlay() {
  return (
    <div
      data-testid="home-non-operated-overlay"
      className="absolute inset-0 z-10 flex touch-none items-center justify-center overflow-hidden border border-white/30 bg-white/70 overscroll-none backdrop-blur-sm"
    >
      <div className="px-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <ShieldAlert className="h-8 w-8 text-gray-400" />
        </div>
        <p className="mb-1 text-base font-bold text-(--knu-text-primary)">
          해당 캠퍼스는 서비스 운영 준비 중이에요!
        </p>
        <p className="text-sm text-(--knu-text-secondary)">조금만 기다려주세요.</p>
      </div>
    </div>
  );
}
