import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingSentenceText } from '../LandingSentenceText';

describe('LandingSentenceText', () => {
  it('문장 단위로 줄바꿈하되 이메일 주소의 점은 보존한다', () => {
    const { container } = render(
      <LandingSentenceText text="학교 이메일 @kangwon.ac.kr 인증을 진행합니다. 다음 안내를 확인합니다." />,
    );

    expect(screen.getByText(/@kangwon\.ac\.kr/)).toBeInTheDocument();
    expect(container.querySelectorAll('br')).toHaveLength(1);
  });
});
