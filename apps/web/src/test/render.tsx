import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type AppTestProvidersProps = {
  children: ReactNode;
};

function AppTestProviders({ children }: AppTestProvidersProps) {
  return <>{children}</>;
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AppTestProviders, ...options }),
  };
}

export * from '@testing-library/react';
export { userEvent };
