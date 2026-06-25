import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignupProgress } from '../SignupProgress';

describe('SignupProgress', () => {
  it('현재 단계 label과 aria-current step을 제공한다', () => {
    render(<SignupProgress currentStep={3} />);

    expect(screen.getByText('회원가입 진행')).toBeInTheDocument();
    expect(screen.getByText('단계 3/4')).toBeInTheDocument();
    expect(screen.getByText('현재 단계: 계정 정보 입력')).toBeInTheDocument();

    const list = screen.getByRole('list', { name: '회원가입 진행 단계' });
    const currentStep = within(list).getByText('계정 정보 입력').closest('li');
    expect(currentStep).toHaveAttribute('aria-current', 'step');
  });

  it('진행률은 보조 정보로 제공하고 step label을 함께 표시한다', () => {
    render(<SignupProgress currentStep={2} />);

    expect(screen.getByRole('progressbar', { name: '회원가입 진행률' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('필수 동의 확인')).toBeInTheDocument();
  });
});
