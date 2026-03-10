import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileMbtiSelector } from '../ProfileMbtiSelector';

describe('ProfileMbtiSelector', () => {
  it('초기값 null이면 초기화 버튼이 숨겨진다', () => {
    render(<ProfileMbtiSelector value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '초기화' })).not.toBeInTheDocument();
  });

  it('초기값이 있으면 해당 MBTI 문자열이 표시된다', () => {
    render(<ProfileMbtiSelector value="ENTP" onChange={vi.fn()} />);
    expect(screen.getByText('ENTP')).toBeInTheDocument();
  });

  it('하나의 차원을 선택하면 onChange(null)이 호출되고 안내 메시지가 표시된다', () => {
    const onChange = vi.fn();
    render(<ProfileMbtiSelector value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'E' }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText(/3개 더 선택해주세요/)).toBeInTheDocument();
  });

  it('4개 차원을 모두 선택하면 onChange에 정렬된 MBTI가 전달된다', () => {
    const onChange = vi.fn();
    render(<ProfileMbtiSelector value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    fireEvent.click(screen.getByRole('button', { name: 'N' }));
    fireEvent.click(screen.getByRole('button', { name: 'F' }));
    fireEvent.click(screen.getByRole('button', { name: 'P' }));

    expect(onChange).toHaveBeenLastCalledWith('INFP');
  });

  it('같은 차원의 반대 옵션을 클릭하면 전환된다', () => {
    const onChange = vi.fn();
    render(<ProfileMbtiSelector value="ENTP" onChange={onChange} />);

    // E가 선택된 상태에서 I 클릭 → E→I 전환
    fireEvent.click(screen.getByRole('button', { name: 'I' }));

    expect(onChange).toHaveBeenLastCalledWith('INTP');
  });

  it('이미 선택된 글자를 클릭하면 반대 옵션으로 전환된다', () => {
    const onChange = vi.fn();
    render(<ProfileMbtiSelector value="ENTP" onChange={onChange} />);

    // E 선택 상태에서 E 재클릭 → I로 전환
    fireEvent.click(screen.getByRole('button', { name: 'E' }));

    expect(onChange).toHaveBeenLastCalledWith('INTP');
  });

  it('초기화 버튼이 draft를 비우고 onChange(null)을 호출한다', () => {
    const onChange = vi.fn();
    render(<ProfileMbtiSelector value="ENTP" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText('ENTP')).not.toBeInTheDocument();
  });

  it('부모 value가 변경되면 draft가 동기화된다', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProfileMbtiSelector value="ENTP" onChange={onChange} />);
    expect(screen.getByText('ENTP')).toBeInTheDocument();

    rerender(<ProfileMbtiSelector value="ISFJ" onChange={onChange} />);
    expect(screen.getByText('ISFJ')).toBeInTheDocument();
  });
});
