import type { Metadata } from 'next';
import NoticesPageClient from '@/notices/NoticesPageClient';

export const metadata: Metadata = {
  title: '공지사항',
  description: 'KNU 룸메 운영 공지사항 상세',
};

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  return <NoticesPageClient initialNoticeId={noticeId} />;
}
