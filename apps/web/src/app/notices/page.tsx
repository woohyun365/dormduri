import type { Metadata } from 'next';
import NoticesPageClient from '@/notices/NoticesPageClient';

export const metadata: Metadata = {
  title: '공지사항',
  description: 'KNU 룸메 운영 공지사항',
};

export default function NoticesPage() {
  return <NoticesPageClient />;
}
