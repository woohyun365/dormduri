import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface AuthHeaderProps {
  onBack?: () => void;
  showBack?: boolean;
  /** 로고 클릭 시 커스텀 동작. false를 반환하면 이동을 취소한다. */
  onLogoClick?: () => boolean;
}

export function AuthHeader({ onBack, showBack = false, onLogoClick }: AuthHeaderProps) {
  const handleLogoClick = (e: React.MouseEvent) => {
    if (onLogoClick && !onLogoClick()) {
      e.preventDefault();
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-[var(--knu-border)]">
      <div className="mx-auto max-w-2xl px-5">
        <div className="flex items-center h-16">
          {showBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--knu-background-alt)] transition-colors mr-2"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="w-6 h-6 text-[var(--knu-text-primary)]" />
            </button>
          )}
          <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2">
            <Image
              src="/knu_logo.svg"
              alt="KNU 로고"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-bold text-[var(--knu-text-primary)]">KNU 룸메</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
