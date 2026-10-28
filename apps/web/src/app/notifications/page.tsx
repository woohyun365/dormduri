import type { Metadata } from 'next';
import NotificationsPageClient from '@/notifications/NotificationsPageClient';

export const metadata: Metadata = {
  title: '알림함',
  description: '돔두리 알림함',
};

export default function NotificationsPage() {
  return <NotificationsPageClient />;
}
