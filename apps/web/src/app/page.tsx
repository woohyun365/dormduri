import type { Metadata } from 'next';
import Landing from '@/landing/Landing';

export const metadata: Metadata = {
  title: 'KNU 룸메 - 강원대 룸메이트 매칭',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스',
};

export default function Home() {
  return <Landing />;
}
