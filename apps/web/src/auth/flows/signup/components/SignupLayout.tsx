import type { ReactNode } from 'react';
import { AuthResponsiveFrame, AuthServiceNotice } from '@/auth/components';

interface SignupLayoutProps {
  children: ReactNode;
  showServiceNotice?: boolean;
  onLogoClick?: () => boolean;
  supportPanel?: ReactNode;
}

export function SignupLayout({
  children,
  showServiceNotice = true,
  onLogoClick,
  supportPanel,
}: SignupLayoutProps) {
  return (
    <AuthResponsiveFrame
      supportPanelLabelledBy="signup-help-title"
      contentLabelledBy="signup-flow-title"
      supportPanelTestId="signup-help-panel"
      onLogoClickAction={onLogoClick}
      align="start"
      stickySupportPanel
      supportPanelVariant="rail"
      contentWidth="lg"
      supportPanel={
        supportPanel ?? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--knu-primary)">
              회원가입
            </p>
            <h2
              id="signup-help-title"
              className="mt-5 keep-all text-2xl font-bold leading-tight text-(--knu-text-primary)"
            >
              가입 정보를 준비하고 있어요
            </h2>
            <p className="mt-3 keep-all text-sm leading-6 text-(--knu-text-secondary)">
              잠시만 기다려 주세요. 이어서 진행할 단계를 확인하고 있어요.
            </p>
          </>
        )
      }
    >
      <h1 id="signup-flow-title" className="sr-only">
        회원가입
      </h1>
      {children}
      {showServiceNotice && <AuthServiceNotice className="mt-6 text-center lg:hidden" />}
    </AuthResponsiveFrame>
  );
}
