import type { Metadata } from 'next';
import ChatRoute from '@/main/routes/ChatRoute';

export const metadata: Metadata = { title: '채팅' };

export default function Page() {
  return <ChatRoute />;
}
