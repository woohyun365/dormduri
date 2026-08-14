import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupCompleteStep } from '../SignupCompleteStep';

describe('SignupCompleteStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('가입 완료 이후 정책 상태를 단정하지 않고 다음 준비를 간결하게 안내한다', () => {
    render(<SignupCompleteStep nickname="테스터" onGoToHome={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '가입을 마쳤어요' })).toHaveFocus();
    expect(screen.getByText('테스터님, 이제 시작해볼까요?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '메인에서 이어서 준비해요' })).toBeInTheDocument();
    expect(screen.getByText('현재 시즌 확인')).toBeInTheDocument();
    expect(screen.getByText('시즌에 맞춰 시작')).toBeInTheDocument();
    expect(screen.queryByText(/비시즌|시즌이 열리면/)).not.toBeInTheDocument();
  });

  it('SignupCompleteStep에서는 다시 보지 않음 저장 액션을 노출하지 않는다', () => {
    render(<SignupCompleteStep nickname="테스터" onGoToHome={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /다시 보지 않음/ })).not.toBeInTheDocument();
  });

  it('CTA는 메인에서 시즌 상태를 확인하도록 이동 콜백을 실행한다', () => {
    const onGoToHome = vi.fn();
    render(<SignupCompleteStep nickname="테스터" onGoToHome={onGoToHome} />);

    fireEvent.click(screen.getByRole('button', { name: '메인으로 이동' }));

    expect(onGoToHome).toHaveBeenCalledTimes(1);
  });
});
