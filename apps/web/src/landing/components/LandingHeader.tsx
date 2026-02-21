'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface LandingHeaderProps {
  onLoginClick?: () => void;
  onStartClick?: () => void;
}

export function LandingHeader({ onLoginClick, onStartClick }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[var(--knu-border)]">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/knu_logo.svg"
                alt="KNU 룸메 로고"
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-xl font-bold text-[var(--knu-text-primary)] hidden sm:inline">
                KNU 룸메
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={onLoginClick}
              className="h-11 px-6 text-[var(--knu-text-secondary)] hover:text-[var(--knu-text-primary)] font-semibold transition-colors"
            >
              로그인
            </button>
            <button
              type="button"
              onClick={onStartClick}
              className="h-11 px-6 bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-semibold rounded-xl transition-all shadow-sm"
            >
              시작하기
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--knu-background-alt)] transition-colors"
            aria-label="메뉴"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-[var(--knu-text-primary)]" />
            ) : (
              <Menu className="w-6 h-6 text-[var(--knu-text-primary)]" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[var(--knu-border)]">
            <nav className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onLoginClick}
                className="h-12 px-4 text-left text-[var(--knu-text-secondary)] hover:bg-[var(--knu-background-alt)] rounded-xl font-semibold transition-colors"
              >
                로그인
              </button>
              <button
                type="button"
                onClick={onStartClick}
                className="h-12 px-4 bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-semibold rounded-xl transition-all"
              >
                시작하기
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
