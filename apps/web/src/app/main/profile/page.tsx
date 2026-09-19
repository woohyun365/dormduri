import type { Metadata } from 'next';
import ProfileRoute from '@/main/routes/ProfileRoute';

export const metadata: Metadata = { title: '내 프로필' };

export default function Page() {
  return <ProfileRoute />;
}
