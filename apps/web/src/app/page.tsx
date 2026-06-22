import type { Metadata } from 'next';
import { createLandingMetadata } from './metadata';
import { Suspense } from 'react';
import Landing from '@/landing/Landing';
import {
  LandingDynamicFaqSection,
  LandingFaqSectionSkeleton,
} from '@/landing/sections/LandingFaqSection';

export const revalidate = 300;

export const metadata: Metadata = createLandingMetadata();

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
