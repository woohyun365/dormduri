import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteError from '../error';
import GlobalError from '../global-error';
import { createRecordingOperationalTelemetryAdapter } from '@/observability/operational/adapters/recording';
import {
  operationalTelemetry,
  setOperationalTelemetryAdapter,
} from '@/observability/operational/operational-telemetry';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

describe('App Router error recovery UI', () => {
  let restoreAdapter: () => void = () => undefined;
  const recording = createRecordingOperationalTelemetryAdapter();

  beforeEach(() => {
    recording.clear();
    restoreAdapter = setOperationalTelemetryAdapter(recording);
  });

  afterEach(() => {
    restoreAdapter();
  });

  it('route error를 기술 정보 없이 안내하고 reset을 호출한다', async () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('sensitive form value'), { digest: 'digest-value' });
    render(<RouteError error={error} reset={reset} />);

    const heading = screen.getByRole('heading', { name: '화면을 불러오지 못했어요' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByText(/sensitive form value|digest-value/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledTimes(1);
    await operationalTelemetry.flush();
    expect(recording.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: 'web_runtime_error',
          source: 'route_boundary',
          recoveryAction: 'retry',
        }),
      ]),
    );
    expect(JSON.stringify(recording.events)).not.toContain('sensitive form value');
  });

  it('global error는 standalone 새로고침 UI를 렌더링한다', async () => {
    render(<GlobalError error={new TypeError('private details')} />);

    const heading = screen.getByRole('heading', { name: '서비스를 불러오지 못했어요' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
    expect(screen.queryByText('private details')).not.toBeInTheDocument();
  });
});
