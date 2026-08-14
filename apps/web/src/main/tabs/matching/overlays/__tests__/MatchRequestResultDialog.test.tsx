import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatchRequestResultDialog } from '../MatchRequestResultDialog';

describe('MatchRequestResultDialog', () => {
  it.each([
    ['rejectRequest', '매칭 요청을 거절했어요.', '상대에게는 요청이 종료된 상태만 알려요.'],
    ['cancelRequest', '보낸 매칭 요청을 취소했어요.', '다른 요청과 대화는 그대로 유지돼요.'],
  ] as const)('%s 완료 메시지를 dialog title로 사용한다', (action, message, description) => {
    render(
      <MatchRequestResultDialog
        celebration={null}
        completion={{ action, requestId: 'request-1', message }}
        onCloseCompletion={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: message })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });
});
