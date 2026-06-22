import type { Metadata } from 'next';
import { Suspense } from 'react';
import Landing from '@/landing/Landing';
import {
  LandingDynamicFaqSection,
  LandingFaqSectionSkeleton,
} from '@/landing/sections/LandingFaqSection';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'KNU 룸메 - 강원대 룸메이트 매칭',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스',
};

export default function Home() {
  return (
    <Landing
      faqSection={
        <Suspense fallback={<LandingFaqSectionSkeleton />}>
          <LandingDynamicFaqSection />
        </Suspense>
      }
    />
  );
}
