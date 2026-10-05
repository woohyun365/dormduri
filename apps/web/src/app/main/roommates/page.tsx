import type { Metadata } from 'next';
import RoommatesRoute from '@/main/routes/RoommatesRoute';

export const metadata: Metadata = { title: '룸메 찾기' };

export default function Page() {
  return <RoommatesRoute />;
}
