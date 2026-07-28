import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SignupAccountData } from '../../model/signup-account.types';
import { getSignupCampusMatchingCopy } from '../../model/signup-academic-copy';
import { AcademicIdentityStep } from '../AcademicIdentityStep';

vi.mock('lucide-react', () => ({
  AlertCircle: () => null,
  ChevronDown: () => null,
  GraduationCap: () => null,
  Info: () => null,
}));

const CURRENT_YEAR = new Date().getFullYear();
const MIN_SIGNUP_BIRTH_YEAR = CURRENT_YEAR - 30;
const MAX_SIGNUP_BIRTH_YEAR = CURRENT_YEAR - 18;
const VALID_SIGNUP_BIRTH_YEAR = CURRENT_YEAR - 24;

const baseAccountData: SignupAccountData = {
  nickname: '테스터',
  password: 'Test1234',
  passwordConfirm: 'Test1234',
  gender: null,
  campus: null,
  collegeCode: null,
  birthYear: null,
};

function renderWithState(overrides: { onNext?: (data: SignupAccountData) => void } = {}) {
  const onNext = overrides.onNext ?? vi.fn<(data: SignupAccountData) => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [accountData, setAccountData] = useState<SignupAccountData>(baseAccountData);
    return (
      <AcademicIdentityStep
        accountData={accountData}
        onAccountDataChange={setAccountData}
        onNext={onNext}
        onBack={onBack}
      />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

function fillValidAcademicIdentity() {
  fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
  fireEvent.click(screen.getByRole('radio', { name: '남성' }));
  fireEvent.change(screen.getByLabelText(/단과대/), { target: { value: 'CHUNCHEON_IT' } });
  fireEvent.change(screen.getByLabelText(/출생연도/), {
    target: { value: String(VALID_SIGNUP_BIRTH_YEAR) },
  });
}

describe('AcademicIdentityStep', () => {
  it('학교·기본 정보가 비어 있으면 해당 오류를 한 화면에서 안내한다', async () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('button', { name: '가입하기' }));

    expect(await screen.findByText('캠퍼스를 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('성별을 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('단과대를 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('출생연도를 선택해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('가입 연령 범위에 맞는 출생연도 옵션을 제공한다', () => {
    renderWithState();

    expect(
      screen.getByRole('option', { name: `${VALID_SIGNUP_BIRTH_YEAR}년` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: `${MIN_SIGNUP_BIRTH_YEAR}년` })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: `${MAX_SIGNUP_BIRTH_YEAR}년` })).toBeInTheDocument();
  });

  it('캠퍼스를 변경하면 새 catalog에 없는 단과대를 초기화한다', () => {
    renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
    fireEvent.change(screen.getByLabelText(/단과대/), { target: { value: 'CHUNCHEON_IT' } });
    fireEvent.click(screen.getByRole('radio', { name: '삼척캠퍼스' }));

    expect(screen.getByLabelText(/단과대/)).toHaveValue('');
    expect(screen.getByLabelText(/단과대/)).toBeEnabled();
    expect(screen.getByRole('option', { name: '공학대' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '인문사회대' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '디자인스포츠대' })).toBeInTheDocument();
  });

  it('도계캠퍼스의 2026 단과대 catalog를 제공한다', () => {
    renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '도계캠퍼스' }));

    expect(screen.getByLabelText(/단과대/)).toBeEnabled();
    expect(screen.getByRole('option', { name: '공학대' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '인문사회대' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '보건과학대' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '자유전공학부' })).toBeInTheDocument();
    expect(screen.getByText(getSignupCampusMatchingCopy('DOGYE'))).toBeInTheDocument();
  });

  it('삼척캠퍼스도 운영 생활관 기준의 매칭 안내를 제공한다', () => {
    renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '삼척캠퍼스' }));

    expect(screen.getByText(getSignupCampusMatchingCopy('SAMCHEOK'))).toBeInTheDocument();
    expect(screen.queryByText(/아직 매칭을 이용할 수 없어요/)).not.toBeInTheDocument();
  });

  it('모든 학교·기본 정보를 입력하면 가입 요청 단계로 전달한다', async () => {
    const { onNext } = renderWithState();
    fillValidAcademicIdentity();

    fireEvent.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: '테스터',
          gender: 'M',
          campus: 'CHUNCHEON',
          collegeCode: 'CHUNCHEON_IT',
          birthYear: VALID_SIGNUP_BIRTH_YEAR,
        }),
      );
    });
  });

  it('제출 중에는 최종 CTA를 비활성화한다', () => {
    render(
      <AcademicIdentityStep
        accountData={baseAccountData}
        onAccountDataChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        nextLabel="처리 중..."
        disabled
      />,
    );

    expect(screen.getByRole('button', { name: '처리 중...' })).toBeDisabled();
  });

  it('제출 실패는 가입 CTA 바로 앞에서 별도 CTA 없이 안내한다', () => {
    render(
      <AcademicIdentityStep
        accountData={baseAccountData}
        onAccountDataChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        submissionError="네트워크 연결을 확인하고 다시 시도해주세요."
      />,
    );

    const alert = screen.getByRole('alert');
    const submitButton = screen.getByRole('button', { name: '가입하기' });

    expect(alert).toHaveTextContent('네트워크 연결을 확인하고 다시 시도해주세요.');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(alert.compareDocumentPosition(submitButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
