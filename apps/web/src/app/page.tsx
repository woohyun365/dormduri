import type { Metadata } from 'next';
import { createLandingMetadata } from './metadata';
import LandingPage from '@/landing/LandingPage';

export const metadata: Metadata = createLandingMetadata();

export default function Home() {
  return <LandingPage />;
}
