import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchingCompactCard } from '../MatchingCompactCard';

describe('MatchingCompactCard', () => {
  it('statusPulse=false면 상태 dot에 pulse 애니메이션을 렌더링하지 않는다', () => {
    const { container } = render(
      <MatchingCompactCard
        nickname="테스트"
        dormitoryId="toegye"
        matchScore={80}
        scoreType="full"
        status={{ label: '이력', color: 'text-gray-500', dotColor: 'bg-gray-400' }}
        statusPulse={false}
      />,
    );

    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('hoverEffect=false면 이력 카드 hover 클래스가 붙지 않는다', () => {
    const { container } = render(
      <MatchingCompactCard
        nickname="테스트"
        dormitoryId="toegye"
        matchScore={80}
        scoreType="full"
        status={{ label: '이력', color: 'text-gray-500', dotColor: 'bg-gray-400' }}
        opacity={0.75}
        hoverEffect={false}
      />,
    );

    const card = container.firstElementChild;
    expect(card?.className).toContain('opacity-75');
    expect(card?.className).not.toContain('hover:opacity-100');
    expect(card?.className).not.toContain('hover:-translate-y-0.5');
  });

  it('message가 있으면 한마디 영역에 lucide 아이콘을 렌더링한다', () => {
    const { container } = render(
      <MatchingCompactCard
        nickname="테스트"
        dormitoryId="toegye"
        matchScore={80}
        scoreType="full"
        status={{ label: '요청 대기', color: 'text-blue-600', dotColor: 'bg-blue-400' }}
        message="안녕하세요!"
      />,
    );

    expect(container.querySelector('.lucide-message-square')).not.toBeNull();
  });

  it('더보기 메뉴가 열리면 카드 z-index를 올려 메뉴가 덮이지 않게 한다', async () => {
    const ui = userEvent.setup();
    const { container } = render(
      <MatchingCompactCard
        nickname="테스트"
        dormitoryId="toegye"
        matchScore={80}
        scoreType="full"
        status={{ label: '요청 대기', color: 'text-blue-600', dotColor: 'bg-blue-400' }}
        menuItems={[{ label: '프로필 보기', onClick: () => {} }]}
      />,
    );

    await ui.click(screen.getByRole('button', { name: '더보기' }));

    const card = container.firstElementChild;
    expect(card?.className).toContain('z-30');
    expect(screen.getByText('프로필 보기')).toBeInTheDocument();
  });
});
