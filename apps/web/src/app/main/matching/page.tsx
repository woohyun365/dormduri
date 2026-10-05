import type { Metadata } from 'next';
import MatchingRoute from '@/main/routes/MatchingRoute';

export const metadata: Metadata = { title: '매칭 현황' };

export default function Page() {
  return <MatchingRoute />;
}
