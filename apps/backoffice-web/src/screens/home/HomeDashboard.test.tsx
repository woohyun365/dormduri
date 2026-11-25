import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionInfoResponse } from '@repo/shared/backoffice';
import { activeOwner } from '@/ui/__stories__/fixtures';
import { HomeDashboard } from './HomeDashboard';

// The home dashboard (design guide ④ dashboard): what waits for the operator, from values the API already gives. The
// home page decides whether to read the pending requests (`admin:access:approve`); this screen gets the result.

const ready: SessionInfoResponse = {
  ...activeOwner.session,
  totpConfirmed: true,
  recoveryCodesRemaining: 8,
};

function todo() {
  return screen.getByRole('region', { name: '처리할 일' });
}

describe('HomeDashboard', () => {
  it('shows the pending count with a link to 권한 요청 for an approver', () => {
    render(<HomeDashboard session={ready} pending={{ count: 2, overflow: false }} />);
    expect(todo()).toHaveTextContent('결정을 기다리는 권한 요청 2건');
    expect(screen.getByRole('link', { name: '권한 요청 보기' })).toHaveAttribute(
      'href',
      '/access?status=PENDING',
    );
  });

  it('says 50건 이상 when the first page has a next page', () => {
    render(<HomeDashboard session={ready} pending={{ count: 50, overflow: true }} />);
    expect(todo()).toHaveTextContent('결정을 기다리는 권한 요청 50건 이상');
  });

  it('hides the pending row without the approve permission', () => {
    render(
      <HomeDashboard
        session={{ ...activeOwner.session, totpConfirmed: false, recoveryCodesRemaining: 0 }}
        pending={null}
      />,
    );
    expect(todo()).not.toHaveTextContent('결정을 기다리는 권한 요청');
    expect(screen.queryByRole('link', { name: '권한 요청 보기' })).toBeNull();
  });

  it('warns about a missing recovery method with a link to 내 보안 설정', () => {
    render(
      <HomeDashboard
        session={{ ...ready, recoveryCodesRemaining: 0 }}
        pending={{ count: 1, overflow: false }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'passkey를 잃었을 때 쓸 복구 수단이 준비되지 않았습니다. TOTP를 확인하고 복구 code를 발급하세요.',
    );
    expect(screen.getByRole('link', { name: '내 보안 설정' })).toHaveAttribute('href', '/security');
  });

  it('says 지금 처리할 일이 없습니다. when nothing waits', () => {
    const view = render(<HomeDashboard session={ready} pending={null} />);
    expect(todo()).toHaveTextContent('지금 처리할 일이 없습니다.');
    // An approver with no pending request has nothing to do either.
    view.rerender(<HomeDashboard session={ready} pending={{ count: 0, overflow: false }} />);
    expect(todo()).toHaveTextContent('지금 처리할 일이 없습니다.');
    expect(todo()).not.toHaveTextContent('결정을 기다리는 권한 요청');
    // A waiting row takes the sentence's place.
    view.rerender(<HomeDashboard session={ready} pending={{ count: 3, overflow: false }} />);
    expect(todo()).not.toHaveTextContent('지금 처리할 일이 없습니다.');
  });
});
