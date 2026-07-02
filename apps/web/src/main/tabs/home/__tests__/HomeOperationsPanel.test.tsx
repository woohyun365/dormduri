import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeOperationsPanel } from '../components/HomeOperationsPanel';

describe('HomeOperationsPanel', () => {
  it('공지사항, 알림함, 문의하기 fallback UI를 제공한다', () => {
    render(<HomeOperationsPanel />);

    expect(screen.getByText('필요한 소식을 확인해요')).toBeInTheDocument();
    expect(screen.getByText('공지사항')).toBeInTheDocument();
    expect(screen.getByText('알림함')).toBeInTheDocument();
    expect(screen.getByText('문의하기')).toBeInTheDocument();
    expect(screen.getByText('새 공지사항이 없어요.')).toBeInTheDocument();
    expect(screen.getByText('새 알림이 없어요.')).toBeInTheDocument();
    expect(screen.getByText('진행 중인 문의가 없어요.')).toBeInTheDocument();
  });

  it('운영 카드 클릭 시 fallback dialog를 연다', async () => {
    const user = userEvent.setup();
    render(<HomeOperationsPanel />);

    await user.click(screen.getByRole('button', { name: /알림함/ }));

    expect(screen.getByRole('dialog', { name: '알림함' })).toBeInTheDocument();
    expect(
      screen.getByText(/매칭 요청, 문의 답변, 시즌 공지처럼 확인이 필요한 알림/),
    ).toBeInTheDocument();
  });
});
