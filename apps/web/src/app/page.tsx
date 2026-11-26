import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { loadLegalRevisionNotices } from '@/legal/api/legal-document.server';
import { createLandingMetadata } from './metadata';
import { LandingScreen } from '@/screens/landing';

export const metadata: Metadata = createLandingMetadata();

// The landing draws to the screen edge, so on an iPhone in landscape its background fills the safe area
// strips beside the sensor housing; its text and buttons keep inside the safe area (px-gutter-safe).
// Merged with the default viewport (device width, scale 1); other routes keep viewport-fit auto.
export const viewport: Viewport = { viewportFit: 'cover' };

// How long the landing waits for the revision notices: a stalled API would otherwise hold the whole
// first response for the loader's own timeout (Owner 2026-11-26). Past it the landing draws without the line.
const REVISION_NOTICES_TIMEOUT_MS = 500;

// The legal revision line reads the public reading API's announced versions per request (D-LU17):
// connection() keeps the page out of the build's static output without force-dynamic. Only an API
// answer draws the line; a kept copy can name a version already in force, so the read keeps no copy
// and serves none, and with no answer the landing draws without the line.
export default async function Home() {
  await connection();
  const notices = await loadLegalRevisionNotices({
    timeoutMs: REVISION_NOTICES_TIMEOUT_MS,
    lastSuccess: 'none',
  });
  return (
    <LandingScreen revisionNotices={notices.status === 'published' ? notices.data.notices : []} />
  );
}
