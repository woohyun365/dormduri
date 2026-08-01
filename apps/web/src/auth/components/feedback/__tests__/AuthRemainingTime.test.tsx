import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AuthRemainingTime,
  formatCompactAuthRemainingTime,
  formatAuthRemainingTime,
} from '../AuthRemainingTime';

describe('AuthRemainingTime', () => {
  it('1분 미만은 분 단위를 생략하고 초만 표시한다', () => {
    expect(formatAuthRemainingTime(59)).toBe('59초');
    expect(formatAuthRemainingTime(3)).toBe('3초');
  });

  it('1분 이상은 분과 남은 초를 표시한다', () => {
    expect(formatAuthRemainingTime(60)).toBe('1분');
    expect(formatAuthRemainingTime(597)).toBe('9분 57초');
  });

  it('시각 문구와 동일한 남은 시간을 접근성 이름으로 제공한다', () => {
    render(<AuthRemainingTime value="57초" contextLabel="인증 요청 제한" />);

    expect(screen.getByRole('timer')).toHaveTextContent('남은 시간: 57초');
    expect(screen.getByRole('timer')).toHaveAccessibleName('인증 요청 제한 남은 시간 57초');
  });

  it('버튼용 compact 시간은 1분 이상을 디지털 형식으로 표시한다', () => {
    expect(formatCompactAuthRemainingTime(597)).toBe('9:57');
    expect(formatCompactAuthRemainingTime(57)).toBe('57초');
  });
});
