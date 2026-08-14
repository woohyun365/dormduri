import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateSearchHeader } from '../../../roommate-list/sections/header/RoommateSearchHeader';
import { MatchingTabHeader } from '../MatchingTabHeader';
import { MatchingTabLayout } from '../MatchingTabLayout';

describe('MatchingTab layout', () => {
  it('RoommateTab과 MatchingTab header가 같은 MainTabHeaderFrame을 사용한다', () => {
    const { rerender } = render(
      <RoommateSearchHeader
        nickname="나"
        gender="M"
        residenceLabel="다산관 · 2인실"
        campusLabel="춘천캠퍼스"
      />,
    );

    expect(screen.getByTestId('main-tab-header-frame')).toHaveAttribute('data-tone', 'primary');
    expect(screen.getByTestId('main-tab-header-frame')).toHaveAttribute('data-width', 'home');
    expect(screen.getByTestId('main-tab-header-frame').firstElementChild).toHaveClass('max-w-md');
    expect(screen.getByTestId('main-tab-header-frame').firstElementChild).toHaveClass(
      'md:max-w-5xl',
    );

    rerender(<MatchingTabHeader />);
    expect(screen.getByTestId('main-tab-header-frame')).toHaveAttribute('data-tone', 'primary');
    expect(screen.getByTestId('main-tab-header-frame')).toHaveAttribute('data-width', 'home');
    expect(screen.getByTestId('main-tab-header-frame').firstElementChild).toHaveClass('max-w-md');
    expect(screen.getByTestId('main-tab-header-frame').firstElementChild).toHaveClass(
      'md:max-w-5xl',
    );
  });

  it('archive content는 HomeTab과 같은 mobile/desktop width contract를 사용한다', () => {
    render(<MatchingTabLayout width="archive">archive</MatchingTabLayout>);

    expect(screen.getByTestId('matching-tab-layout')).toHaveClass('max-w-md');
    expect(screen.getByTestId('matching-tab-layout')).toHaveClass('md:max-w-5xl');
    expect(screen.getByTestId('matching-tab-layout')).not.toHaveClass('max-w-6xl');
  });

  it('Main의 page main 안에서 nested main 없이 primary와 supporting content를 순서대로 제공한다', () => {
    const { container } = render(
      <main>
        <MatchingTabHeader />
        <MatchingTabLayout>
          <p>primary</p>
        </MatchingTabLayout>
      </main>,
    );

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getByTestId('matching-tab-layout')).toHaveAccessibleName('매칭 현황');

    expect(screen.getByTestId('matching-tab-primary')).toHaveTextContent('primary');
  });

  it('legacy pair identity와 profile navigation을 production header props로 연결한다', async () => {
    const user = userEvent.setup();
    const onNavigateProfile = vi.fn();
    render(
      <MatchingTabHeader
        hero={{
          tone: 'action',
          eyebrow: '현재 시즌',
          statusLabel: '매칭 진행 중',
          title: '받은 요청부터 확인해보세요',
          description: '받은 요청 2건을 먼저 확인할 수 있어요.',
        }}
        viewer={{
          nickname: '나',
          gender: 'M',
          campusLabel: '춘천캠퍼스',
          residenceLabel: '다산관 · 2인실',
        }}
        deadlineLabel="D-7"
        onNavigateProfile={onNavigateProfile}
      />,
    );

    expect(screen.getByTestId('matching-tab-hero')).toHaveAttribute(
      'data-design-source',
      'legacy-pair',
    );
    expect(screen.getByRole('heading', { name: '나님' })).toBeInTheDocument();
    expect(screen.getByText('다산관 · 2인실')).toBeInTheDocument();
    expect(screen.getByText('D-7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '나 프로필 보기' }));
    expect(onNavigateProfile).toHaveBeenCalledOnce();
  });
});
