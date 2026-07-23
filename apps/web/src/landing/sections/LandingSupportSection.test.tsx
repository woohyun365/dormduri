import { render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingSupportSection } from './LandingSupportSection';

vi.mock('lucide-react', () => ({
  AlertTriangle: () => null,
  CircleDashed: () => null,
  ClipboardCheck: () => null,
  Flag: () => null,
  MessageCircle: () => null,
  MessageSquareText: () => null,
  MessagesSquare: () => null,
  Shield: () => null,
  ShieldCheck: () => null,
  UserCheck: () => null,
}));

describe('LandingSupportSection', () => {
  it('개인정보 안내와 서비스 내부의 신고·문의 경로를 안내한다', () => {
    const { container } = render(<LandingSupportSection />);
    const section = container.querySelector<HTMLElement>('#support');

    expect(section).not.toBeNull();
    expect(
      within(section!).getByRole('heading', {
        name: '서비스 이용 중 도움이 필요하다면',
      }),
    ).toBeInTheDocument();
    expect(within(section!).getByText('상황에 맞는 도움 방법을 확인해요.')).toBeInTheDocument();
    expect(within(section!).getByText('공개 정보는 꼭 필요한 만큼만')).toBeInTheDocument();
    expect(
      within(section!).getByText('실명·학번·연락처·SNS 등 개인 정보는 적지 않는 것을 권장해요.'),
    ).toBeInTheDocument();
    expect(within(section!).getByText('1:1 채팅')).toBeInTheDocument();
    expect(
      within(section!).getByText('상대와 신뢰를 확인한 뒤 필요한 범위에서 공유해요.'),
    ).toBeInTheDocument();
    expect(within(section!).getByText('타인 정보')).toBeInTheDocument();
    expect(
      within(section!).getByText('개인정보나 사생활 정보를 동의 없이 공개하지 마세요.'),
    ).toBeInTheDocument();
    expect(within(section!).getByText('신고·차단')).toBeInTheDocument();
    expect(within(section!).getByText('신고할 수 있는 내용')).toBeInTheDocument();
    expect(within(section!).getByText('욕설·성적 표현이 있는 닉네임·자기소개')).toBeInTheDocument();
    expect(
      within(section!).getByText('성별 사칭이나 허위 기숙사·생활패턴 정보'),
    ).toBeInTheDocument();
    expect(
      within(section!).getByText('장애·성적 지향 등에 대한 혐오·차별 표현'),
    ).toBeInTheDocument();
    expect(within(section!).getByText('협박·개인정보 노출·반복 스팸 채팅')).toBeInTheDocument();
    expect(within(section!).getAllByText('이용 위치')).toHaveLength(2);
    expect(within(section!).getByText('상대 프로필·채팅 화면')).toBeInTheDocument();
    expect(within(section!).getByText('서비스 이용 문의')).toBeInTheDocument();
    expect(within(section!).getByText('문의 범위')).toBeInTheDocument();
    expect(within(section!).getByText('철회한 시즌 재참여 문의')).toBeInTheDocument();
    expect(within(section!).getByText('등록을 마친 뒤 기숙사 오입력 수정')).toBeInTheDocument();
    expect(within(section!).getByText('캠퍼스·출생연도·단과대 정보 정정')).toBeInTheDocument();
    expect(within(section!).getByText('신고·제재 결과 재검토')).toBeInTheDocument();
    expect(within(section!).queryByText('시즌 참여 철회')).not.toBeInTheDocument();
    expect(within(section!).getByText('로그인 후 문의하기 페이지')).toBeInTheDocument();
    expect(within(section!).queryByText('예시')).not.toBeInTheDocument();
    expect(within(section!).queryByText('서비스 외부 문의')).not.toBeInTheDocument();
    expect(within(section!).queryAllByRole('link')).toHaveLength(0);
    expect(within(section!).queryAllByRole('button')).toHaveLength(0);
  });
});
