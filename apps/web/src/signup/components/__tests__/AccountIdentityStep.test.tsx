import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountIdentityStep, type BasicInfoData } from '../AccountIdentityStep';
import { authApi } from '@/api/auth';

vi.mock('lucide-react', () => ({
  User: () => null,
  Check: () => null,
  Eye: () => null,
  EyeOff: () => null,
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    validateSignupDraft: vi.fn(),
  },
}));

const mockValidateSignupDraft = vi.mocked(authApi.validateSignupDraft);

const CURRENT_YEAR = new Date().getFullYear();
const MIN_SIGNUP_BIRTH_YEAR = CURRENT_YEAR - 30;
const MAX_SIGNUP_BIRTH_YEAR = CURRENT_YEAR - 18;
const VALID_SIGNUP_BIRTH_YEAR = CURRENT_YEAR - 24;

const emptyBasicInfo: BasicInfoData = {
  nickname: '',
  password: '',
  passwordConfirm: '',
  gender: null,
  campus: null,
  collegeCode: null,
  birthYear: null,
};

function renderWithState(overrides: { onNext?: (data: BasicInfoData) => void } = {}) {
  const onNext = overrides.onNext ?? vi.fn<(data: BasicInfoData) => void>();
  const onBack = vi.fn<() => void>();

  function Wrapper() {
    const [basicInfo, setBasicInfo] = useState<BasicInfoData>(emptyBasicInfo);
    return (
      <AccountIdentityStep
        email="test@kangwon.ac.kr"
        basicInfo={basicInfo}
        onBasicInfoChange={setBasicInfo}
        onNext={onNext}
        onBack={onBack}
      />
    );
  }

  return { ...render(<Wrapper />), onNext, onBack };
}

function fillValidAccountIdentity() {
  fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
  fireEvent.click(screen.getByRole('radio', { name: '남성' }));
  fireEvent.change(screen.getByLabelText(/단과대/), { target: { value: 'IT' } });
  fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '테스터' } });
  fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
    target: { value: 'Test1234' },
  });
  fireEvent.change(screen.getByLabelText(/비밀번호 확인/), { target: { value: 'Test1234' } });
  fireEvent.change(screen.getByLabelText(/출생연도/), {
    target: { value: String(VALID_SIGNUP_BIRTH_YEAR) },
  });
}

describe('AccountIdentityStep', () => {
  beforeEach(() => {
    mockValidateSignupDraft.mockReset();
    mockValidateSignupDraft.mockResolvedValue({ success: true });
  });

  it('빈 필드에서 다음 클릭 시 유효성 검사 에러를 표시한다', async () => {
    const { onNext } = renderWithState();

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByText('캠퍼스를 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('성별을 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('단과대를 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('출생연도를 선택해주세요.')).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('출생연도를 직접 입력 대신 선택 옵션으로 제공한다', () => {
    renderWithState();

    const birthYearSelect = screen.getByLabelText(/출생연도/);

    expect(birthYearSelect.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: '출생연도를 선택해주세요' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: `${VALID_SIGNUP_BIRTH_YEAR}년` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: `${MIN_SIGNUP_BIRTH_YEAR}년` })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: `${MAX_SIGNUP_BIRTH_YEAR}년` })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: `${MIN_SIGNUP_BIRTH_YEAR - 1}년` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: `${MAX_SIGNUP_BIRTH_YEAR + 1}년` }),
    ).not.toBeInTheDocument();
  });

  it('캠퍼스와 성별 선택이 가능하고 campus별 단과대 catalog를 노출한다', () => {
    renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
    fireEvent.click(screen.getByRole('radio', { name: '남성' }));

    expect(screen.getByRole('radio', { name: '춘천캠퍼스' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: '남성' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('option', { name: 'IT대' })).toBeInTheDocument();
  });

  it('캠퍼스를 바꾸면 선택된 단과대가 새 campus catalog에 없을 때 초기화된다', () => {
    renderWithState();

    fireEvent.click(screen.getByRole('radio', { name: '춘천캠퍼스' }));
    fireEvent.change(screen.getByLabelText(/단과대/), { target: { value: 'IT' } });
    expect(screen.getByLabelText(/단과대/)).toHaveValue('IT');

    fireEvent.click(screen.getByRole('radio', { name: '삼척캠퍼스' }));

    expect(screen.getByLabelText(/단과대/)).toHaveValue('');
    expect(screen.getByLabelText(/단과대/)).toBeDisabled();
  });

  it('모든 필드를 채우면 validateSignupDraft 호출 후 정규화한 값으로 onNext가 호출된다', async () => {
    const { onNext } = renderWithState();

    fillValidAccountIdentity();
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '  테스터  ' } });
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    await waitFor(() => {
      expect(mockValidateSignupDraft).toHaveBeenCalledWith({
        email: 'test@kangwon.ac.kr',
        nickname: '  테스터  ',
        password: 'Test1234',
      });
      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: '테스터',
          gender: 'M',
          campus: 'CHUNCHEON',
          collegeCode: 'IT',
          birthYear: VALID_SIGNUP_BIRTH_YEAR,
        }),
      );
    });
  });

  it('제출 중이면 전달받은 label을 유지하면서 다음 버튼을 비활성화한다', () => {
    render(
      <AccountIdentityStep
        email="test@kangwon.ac.kr"
        basicInfo={emptyBasicInfo}
        onBasicInfoChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        nextLabel="처리 중..."
        disabled
      />,
    );

    expect(screen.getByRole('button', { name: '처리 중...' })).toBeDisabled();
  });

  it('백엔드 닉네임 정책 오류를 즉시 표시한다', async () => {
    mockValidateSignupDraft.mockResolvedValue({
      success: false,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '사용할 수 없는 표현이 포함되어 있습니다.' },
    });

    const { onNext } = renderWithState();

    fillValidAccountIdentity();
    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '섹스' } });
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    await waitFor(() => {
      expect(screen.getByText('사용할 수 없는 표현이 포함되어 있습니다.')).toBeInTheDocument();
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('닉네임만 입력한 상태에서 서버 금지어 오류가 있으면 닉네임에 우선 포커스한다', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockValidateSignupDraft.mockResolvedValue({
      success: false,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: {
        nickname: '사용할 수 없는 표현이 포함되어 있습니다.',
        password: '비밀번호를 입력해주세요.',
      },
    });

    renderWithState();

    fireEvent.change(screen.getByLabelText(/닉네임/), { target: { value: '섹스' } });
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    await waitFor(() => {
      expect(screen.getByText('사용할 수 없는 표현이 포함되어 있습니다.')).toBeInTheDocument();
    });
    expect(document.activeElement).toBe(screen.getByLabelText(/닉네임/));
  });

  it('비밀번호 입력 시 PasswordRequirementList가 표시된다', () => {
    renderWithState();

    fireEvent.change(screen.getAllByLabelText(/^비밀번호(?!.*확인)/)[0]!, {
      target: { value: 'ab' },
    });

    expect(screen.getByText(/8자 이상/)).toBeInTheDocument();
  });
});
