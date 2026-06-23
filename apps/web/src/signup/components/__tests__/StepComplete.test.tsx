import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StepComplete } from '../StepComplete';

describe('StepComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('가입 완료 이후 signup과 season registration journey를 분리해서 안내한다', () => {
    render(<StepComplete nickname="테스터" onGoToHome={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '계정 생성 완료!' })).toBeInTheDocument();
    expect(screen.getByText(/메인에서 현재 시즌 상태를 확인할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '서비스 시작 전 알아두기' })).toBeInTheDocument();
    expect(
      screen.getByText(/생활패턴, 원하는 룸메 조건, 기숙사 선택은 시즌 화면/),
    ).toBeInTheDocument();
    expect(screen.getByText('현재 시즌 확인하기')).toBeInTheDocument();
    expect(screen.getByText('시즌 프로필 준비하기')).toBeInTheDocument();
    expect(screen.getByText('기숙사 선택 후 룸메 찾기')).toBeInTheDocument();
  });

  it('비시즌 가입자도 다음 행동을 이해할 수 있도록 안내한다', () => {
    render(<StepComplete nickname="테스터" onGoToHome={vi.fn()} />);

    expect(
      screen.getByText(/비시즌에는 아직 프로필 작성이 열리지 않을 수 있어요/),
    ).toBeInTheDocument();
    expect(screen.getByText(/다음 시즌 안내와 내 정보를 먼저 확인/)).toBeInTheDocument();
  });

  it('StepComplete에서는 다시 보지 않음 저장 액션을 노출하지 않는다', () => {
    render(<StepComplete nickname="테스터" onGoToHome={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /다시 보지 않음/ })).not.toBeInTheDocument();
  });

  it('CTA는 메인에서 시즌 상태를 확인하도록 이동 콜백을 실행한다', () => {
    const onGoToHome = vi.fn();
    render(<StepComplete nickname="테스터" onGoToHome={onGoToHome} />);

    fireEvent.click(screen.getByRole('button', { name: '메인에서 시즌 상태 확인하기' }));

    expect(onGoToHome).toHaveBeenCalledTimes(1);
  });
});
