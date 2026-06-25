import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface AuthHeaderProps {
  onBack?: () => void;
  showBack?: boolean;
  /** Header 내부 컨테이너 폭/좌우 padding. 기본값은 인증 flow 공통 narrow layout이다. */
  containerClassName?: string;
  /** 로고 클릭 시 커스텀 동작. false를 반환하면 이동을 취소한다. */
  onLogoClick?: () => boolean;
}

export function AuthHeader({
  onBack,
  showBack = false,
  containerClassName = 'mx-auto max-w-2xl px-5',
  onLogoClick,
}: AuthHeaderProps) {
  const handleLogoClick = (e: React.MouseEvent) => {
    if (onLogoClick && !onLogoClick()) {
      e.preventDefault();
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-(--knu-border) bg-white">
      <div className={containerClassName}>
        <div className="flex h-16 items-center">
          {showBack && (
            <button
              onClick={onBack}
              className="mr-2 flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-(--knu-background-alt)"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="h-6 w-6 text-(--knu-text-primary)" />
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
            <span className="text-lg font-bold text-(--knu-text-primary)">KNU 룸메</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
