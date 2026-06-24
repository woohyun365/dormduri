import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginRedirectTarget } from '../useLoginRedirectTarget';

let nextTarget: string | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'next' ? nextTarget : null),
  }),
}));

describe('useLoginRedirectTarget', () => {
  beforeEach(() => {
    nextTarget = null;
  });

  it('next=/main만 허용한다', () => {
    nextTarget = '/main';

    const { result } = renderHook(() => useLoginRedirectTarget());

    expect(result.current).toBe('/main');
  });

  it('외부 URL이나 미허용 경로는 /main으로 fallback한다', () => {
    nextTarget = 'https://evil.example/main';
    expect(renderHook(() => useLoginRedirectTarget()).result.current).toBe('/main');

    nextTarget = '/profile';
    expect(renderHook(() => useLoginRedirectTarget()).result.current).toBe('/main');
  });
});
