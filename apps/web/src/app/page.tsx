import type { Metadata, Viewport } from 'next';
import { createLandingMetadata } from './metadata';
import { LandingScreen } from '@/screens/landing';

export const metadata: Metadata = createLandingMetadata();

// The landing draws to the screen edge, so on an iPhone in landscape its background fills the safe area
// strips beside the sensor housing; its text and buttons keep inside the safe area (px-gutter-safe).
// Merged with the default viewport (device width, scale 1); other routes keep viewport-fit auto.
export const viewport: Viewport = { viewportFit: 'cover' };

export default function Home() {
  return <LandingScreen />;
}
