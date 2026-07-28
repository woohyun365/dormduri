import type { ReactNode } from 'react';
import { AuthHeader } from '../AuthHeader';

interface AuthResponsiveFrameProps {
  children: ReactNode;
  supportPanel: ReactNode;
  supportPanelLabelledBy: string;
  contentLabelledBy: string;
  supportPanelTestId?: string;
  showBack?: boolean;
  onBackAction?: () => void;
  onLogoClickAction?: () => boolean;
  align?: 'center' | 'start';
  stickySupportPanel?: boolean;
  supportPanelVariant?: 'card' | 'rail';
  contentWidth?: 'md' | 'lg';
}

export function AuthResponsiveFrame({
  children,
  supportPanel,
  supportPanelLabelledBy,
  contentLabelledBy,
  supportPanelTestId,
  showBack = false,
  onBackAction,
  onLogoClickAction,
  align = 'center',
  stickySupportPanel = false,
  supportPanelVariant = 'card',
  contentWidth = 'md',
}: AuthResponsiveFrameProps) {
  const alignmentClassName = align === 'center' ? 'items-center' : 'items-start';
  const supportPanelPositionClassName = stickySupportPanel
    ? 'lg:sticky lg:top-32 lg:self-start'
    : '';
  const gridClassName =
    supportPanelVariant === 'rail'
      ? 'lg:grid-cols-[24rem_minmax(0,30rem)] lg:justify-center lg:gap-8'
      : 'lg:grid-cols-[minmax(0,1fr)_28rem]';
  const supportPanelClassName =
    supportPanelVariant === 'rail'
      ? 'hidden lg:block'
      : 'hidden rounded-3xl border-2 border-(--knu-border) bg-white p-8 shadow-sm lg:block';
  const contentWidthClassName = contentWidth === 'lg' ? 'max-w-lg' : 'max-w-md';

  return (
    <div className="min-h-svh bg-(--knu-background-alt)">
      <AuthHeader
        showBack={showBack}
        onBack={onBackAction}
        onLogoClick={onLogoClickAction}
        containerClassName="mx-auto w-full max-w-5xl px-5 lg:px-8"
      />

      <main
        data-testid="auth-responsive-frame"
        className={`mx-auto grid w-full max-w-5xl gap-8 px-5 py-8 sm:py-10 md:min-h-[calc(100svh-4rem)] md:py-16 lg:px-8 ${gridClassName} ${alignmentClassName}`}
      >
        <aside
          data-testid={supportPanelTestId}
          aria-labelledby={supportPanelLabelledBy}
          className={`${supportPanelClassName} ${supportPanelPositionClassName}`}
        >
          {supportPanel}
        </aside>

        <section
          aria-labelledby={contentLabelledBy}
          className={`mx-auto w-full min-w-0 ${contentWidthClassName} lg:mx-0`}
        >
          {children}
        </section>
      </main>
    </div>
  );
}
