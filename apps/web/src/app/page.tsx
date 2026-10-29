import type { Metadata } from 'next';
import { createLandingMetadata } from './metadata';
import { LandingScreen } from '@/screens/landing';

export const metadata: Metadata = createLandingMetadata();

export default function Home() {
  return <LandingScreen />;
}
