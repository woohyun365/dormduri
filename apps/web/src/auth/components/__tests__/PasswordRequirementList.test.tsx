import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordRequirementList } from '../PasswordRequirementList';

describe('PasswordRequirementList', () => {
  function getRequirement(label: string) {
    const requirement = within(screen.getByRole('list', { name: '비밀번호 조건' }))
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes(label));

    expect(requirement).toBeDefined();
    return requirement!;
  }

  it('입력 전에도 Shared 신규 비밀번호 조건을 안정적인 영역에 안내한다', () => {
    render(<PasswordRequirementList password="" email="test@kangwon.ac.kr" confirmPassword="" />);

    const requirements = screen.getByRole('list', { name: '비밀번호 조건' });
    expect(requirements).toHaveAttribute('aria-live', 'polite');
    expect(getRequirement('10~128자')).toHaveTextContent('10~128자: 확인 전');
    expect(getRequirement('영문·숫자·기호')).toHaveTextContent('영문·숫자·기호만: 확인 전');
    expect(getRequirement('공백 없음')).toHaveTextContent('공백 없음: 확인 전');
    expect(getRequirement('비밀번호 확인 일치')).toHaveTextContent('확인 전');
    expect(getRequirement('10~128자').querySelector('svg')).toHaveClass('lucide-circle');
  });

  it('문자 종류 조합을 강제하지 않고 10자 이상의 허용 문자를 충족 처리한다', () => {
    render(
      <PasswordRequirementList
        password="abcdefghijk"
        email="test@kangwon.ac.kr"
        confirmPassword="abcdefghijk"
      />,
    );

    expect(getRequirement('10~128자')).toHaveTextContent('10~128자: 충족');
    expect(getRequirement('영문·숫자·기호')).toHaveTextContent('영문·숫자·기호만: 충족');
    expect(getRequirement('10~128자').querySelector('svg')).toHaveClass('lucide-circle-check');
    expect(screen.queryByText(/영문 포함|숫자 포함|특수문자 포함/)).not.toBeInTheDocument();
  });

  it('입력을 시작한 뒤 1~9자는 길이 조건을 충족하지 않은 상태로 표시한다', () => {
    render(
      <PasswordRequirementList
        password="short"
        email="test@kangwon.ac.kr"
        confirmPassword="short"
      />,
    );

    expect(getRequirement('10~128자')).toHaveTextContent('확인 필요');
    expect(getRequirement('10~128자').querySelector('svg')).toHaveClass('lucide-circle-x');
  });

  it('ASCII 외 문자는 허용 문자 오류로 안내한다', () => {
    render(
      <PasswordRequirementList
        password="Password한글2026"
        email="test@kangwon.ac.kr"
        confirmPassword="Password한글2026"
      />,
    );

    expect(getRequirement('영문·숫자·기호')).toHaveTextContent('영문·숫자·기호만: 확인 필요');
    expect(getRequirement('영문·숫자·기호').querySelector('svg')).toHaveClass('lucide-circle-x');
  });

  it('공백은 별도 조건으로 안내하고 허용 문자 오류를 중복 표시하지 않는다', () => {
    render(
      <PasswordRequirementList
        password="Password 2026"
        email="test@kangwon.ac.kr"
        confirmPassword="Password 2026"
      />,
    );

    expect(getRequirement('공백 없음')).toHaveTextContent('공백 없음: 확인 필요');
    expect(getRequirement('영문·숫자·기호')).toHaveTextContent('영문·숫자·기호만: 확인 전');
  });

  it('이메일과 동일하면 exact 비교 오류를 표시한다', () => {
    render(
      <PasswordRequirementList
        password="test@kangwon.ac.kr"
        email="test@kangwon.ac.kr"
        confirmPassword="test@kangwon.ac.kr"
      />,
    );

    expect(getRequirement('이메일 정보와 다름')).toHaveTextContent('확인 필요');
  });

  it('학교 이메일 로컬파트와 같으면 이메일 정보 조건을 위반한다', () => {
    render(
      <PasswordRequirementList
        password="knuStudent"
        email="knuStudent@kangwon.ac.kr"
        confirmPassword="knuStudent"
      />,
    );

    expect(getRequirement('이메일 정보와 다름')).toHaveTextContent('확인 필요');
  });

  it('비밀번호 확인은 입력 중 exact match와 mismatch를 live 상태로 구분한다', () => {
    const { rerender } = render(
      <PasswordRequirementList
        password="SafePassword123"
        email="test@kangwon.ac.kr"
        confirmPassword="DifferentPassword123"
      />,
    );

    expect(getRequirement('비밀번호 확인 일치')).toHaveTextContent('확인 필요');

    rerender(
      <PasswordRequirementList
        password="SafePassword123"
        email="test@kangwon.ac.kr"
        confirmPassword="SafePassword123"
      />,
    );

    expect(getRequirement('비밀번호 확인 일치')).toHaveTextContent('충족');
  });

  it('320px에서 조건을 한 열로 유지해 가로 잘림을 만들지 않는다', () => {
    render(
      <PasswordRequirementList
        password="SafePassword123"
        email="test@kangwon.ac.kr"
        confirmPassword="SafePassword123"
      />,
    );

    expect(screen.getByRole('list', { name: '비밀번호 조건' })).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
    );
  });
});
