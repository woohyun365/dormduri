import type { ReactNode } from 'react';
import { AuthResponsiveFrame, AuthServiceNotice } from '@/auth/components';
import { LoginProductPreviewPanel } from './preview/LoginProductPreviewPanel';

interface LoginLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

export function LoginLayout({ children, footer }: LoginLayoutProps) {
  return (
    <AuthResponsiveFrame
      supportPanelLabelledBy="login-preview-title"
      contentLabelledBy="login-title"
      supportPanelTestId="login-help-panel"
      align="start"
      stickySupportPanel
      supportPanelVariant="rail"
      supportPanel={<LoginProductPreviewPanel />}
    >
      <AuthServiceNotice
        className="-mt-6 mb-2 text-center md:hidden"
        copyVariant="compact"
        showDetailsLink={false}
      />
      {children}
      {footer}
    </AuthResponsiveFrame>
  );
}
