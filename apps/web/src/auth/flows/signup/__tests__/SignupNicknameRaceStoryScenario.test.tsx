import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignupNicknameRaceStoryScenario } from '@/auth/stories/fixtures/signup/SignupNicknameRaceStoryScenario';

describe('SignupNicknameRaceStoryScenario', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Step 4 가입 요청의 닉네임 충돌을 입력이 보존된 Step 3으로 복구한다', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    render(<SignupNicknameRaceStoryScenario />);

    expect(screen.getByText('4/5 · 학교·기본 정보')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }));

    expect(await screen.findByDisplayValue('감자친구')).toBeInTheDocument();
    expect(screen.getByText('이미 사용 중인 닉네임이에요.')).toBeInTheDocument();
    expect(screen.getByText('3/5 · 로그인 정보')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /닉네임/ })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: '이전' }));

    expect(await screen.findByText('2/5 · 필수 동의')).toBeInTheDocument();
    expect(screen.queryByText('4/5 · 학교·기본 정보')).not.toBeInTheDocument();

    const legalContinueButton = screen.getByRole('button', { name: '다음 단계' });
    await waitFor(() => expect(legalContinueButton).toBeEnabled());
    fireEvent.click(legalContinueButton);

    expect(await screen.findByText('3/5 · 로그인 정보')).toBeInTheDocument();
    expect(screen.getByDisplayValue('감자친구')).toBeInTheDocument();
  });
});
