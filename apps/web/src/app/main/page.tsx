import { Suspense } from 'react';
import type { Metadata } from 'next';
import Main from '@/main/Main';

export const metadata: Metadata = {
  title: 'KNU 룸메 - 메인',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스',
};

export default function MainPage() {
  return (
    <Suspense>
      <Main />
    </Suspense>
  );
}
