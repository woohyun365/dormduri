import type { ReactNode, Ref } from 'react';

export function MainTabHeaderFrame({
  children,
  tone = 'default',
  width = 'wide',
  contentClassName = '',
  sticky = true,
  frameRef,
}: {
  readonly children: ReactNode;
  readonly tone?: 'default' | 'primary';
  readonly width?: 'wide' | 'home';
  readonly contentClassName?: string;
  readonly sticky?: boolean;
  readonly frameRef?: Ref<HTMLElement>;
}) {
  return (
    <section
      ref={frameRef}
      role="banner"
      data-testid="main-tab-header-frame"
      data-tone={tone}
      data-width={width}
      className={`${sticky ? 'sticky top-0 z-40' : 'relative'} ${
        tone === 'primary'
          ? 'bg-[var(--knu-primary)] text-white'
          : 'border-b-2 border-(--knu-border) bg-white/95 backdrop-blur'
      }`}
    >
      <div
        className={`mx-auto w-full px-4 min-[361px]:px-5 ${
          width === 'home' ? 'max-w-md md:max-w-5xl' : 'max-w-6xl'
        } ${tone === 'primary' ? 'py-6' : 'py-4'} ${contentClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
