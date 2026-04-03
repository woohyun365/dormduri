import type { Metadata } from 'next';
import GatewayPage from '@/components/GatewayPage';

export const metadata: Metadata = {
  title: 'KNU 룸메 - 강원대 룸메이트 매칭',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스',
};

// `/` 게이트웨이는 클라이언트에서 `/api/auth/session`을 확인해 Landing/Main을 분기한다.
// 첫 렌더에서 세션을 확인해야 하므로 동적으로 처리한다.
export const dynamic = 'force-dynamic';

export default function Home() {
  return <GatewayPage />;
}
