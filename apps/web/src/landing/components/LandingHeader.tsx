'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleClose = useCallback(() => setMobileMenuOpen(false), []);

  // C-3: Auto-close mobile menu on desktop resize
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = () => {
      if (mq.matches) setMobileMenuOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    },
    [mobileMenuOpen],
  );

  const NAV_ITEMS = [
    {
      href: '/login',
      label: '로그인',
      variant: 'outline' as const,
    },
    {
      href: '/signup',
      label: '시작하기',
      variant: 'primary' as const,
    },
  ];

  const navStyles = {
    outline: {
      desktop:
        'h-11 px-6 border-2 border-[var(--knu-border)] hover:border-[var(--knu-primary)] hover:text-[var(--knu-primary)] rounded-xl text-[var(--knu-text-secondary)] font-semibold transition-all inline-flex items-center',
      mobile:
        'h-12 px-4 text-center border-2 border-[var(--knu-border)] text-[var(--knu-text-secondary)] hover:border-[var(--knu-primary)] hover:text-[var(--knu-primary)] rounded-xl font-semibold transition-all flex items-center justify-center',
    },
    primary: {
      desktop:
        'h-11 px-6 bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-semibold rounded-xl transition-all shadow-sm inline-flex items-center',
      mobile:
        'h-12 px-4 bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-semibold rounded-xl transition-all flex items-center justify-center',
    },
  };

  return (
    <header
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[var(--knu-border)]"
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center gap-2">
              <Image
                src="/knu_logo.svg"
                alt="KNU 룸메 로고"
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-xl font-bold text-[var(--knu-text-primary)]">KNU 룸메</span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-3">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={navStyles[item.variant].desktop}>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--knu-background-alt)] transition-colors"
            aria-label="메뉴"
            aria-expanded={mobileMenuOpen}
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
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleClose}
                  className={navStyles[item.variant].mobile}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
