import type { Metadata } from 'next';
import GatewayPage from '@/components/GatewayPage';

export const metadata: Metadata = {
  title: 'KNU 룸메 - 강원대 룸메이트 매칭',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스',
};

// useCurrentUser가 클라이언트 전용 상태(localStorage)에 의존.
// 정적 생성 시 "로딩 중..." 만 렌더되어 SSG 이점이 없으므로 dynamic으로 명시.
export const dynamic = 'force-dynamic';

export default function Home() {
  return <GatewayPage />;
}
