import type { Metadata } from 'next';
import HomeRoute from '@/main/routes/HomeRoute';

export const metadata: Metadata = { title: '홈', description: 'KNU 룸메이트 매칭 홈' };

export default function Page() {
  return <HomeRoute />;
}
