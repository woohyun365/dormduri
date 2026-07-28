import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PasswordRequirementList } from '../PasswordRequirementList';

describe('PasswordRequirementList', () => {
  it('비밀번호가 비어있어도 입력 전 조건을 안정적인 영역에 안내한다', () => {
    render(<PasswordRequirementList password="" email="test@kangwon.ac.kr" />);

    expect(screen.getByRole('list', { name: '비밀번호 조건' })).toBeInTheDocument();
    expect(screen.getByText(/○ 8자 이상/)).toBeInTheDocument();
    expect(screen.getByText(/○ 이메일과 다름/)).toBeInTheDocument();
  });

  it('8자 미만이면 길이 미충족을 표시한다', () => {
    render(<PasswordRequirementList password="ab1" email="test@kangwon.ac.kr" />);

    expect(screen.getByText(/○ 8자 이상/)).toBeInTheDocument();
  });

  it('숫자 미포함 시 미충족을 표시한다', () => {
    render(<PasswordRequirementList password="abcdefgh" email="test@kangwon.ac.kr" />);

    expect(screen.getByText(/○ 숫자 포함/)).toBeInTheDocument();
  });

  it('이메일과 동일하면 경고를 표시한다', () => {
    render(<PasswordRequirementList password="test@kangwon.ac.kr" email="test@kangwon.ac.kr" />);

    expect(screen.getByText(/✗ 이메일과 다름/)).toBeInTheDocument();
  });

  it('유효한 비밀번호는 모든 요구사항을 충족 표시한다', () => {
    render(<PasswordRequirementList password="Test1234" email="test@kangwon.ac.kr" />);

    expect(screen.getByText(/✓ 8자 이상/)).toBeInTheDocument();
    expect(screen.getByText(/✓ \d+자 이하/)).toBeInTheDocument();
    expect(screen.getByText(/✓ 영문 포함/)).toBeInTheDocument();
    expect(screen.getByText(/✓ 숫자 포함/)).toBeInTheDocument();
    expect(screen.getByText(/✓ 이메일과 다름/)).toBeInTheDocument();
  });
});
