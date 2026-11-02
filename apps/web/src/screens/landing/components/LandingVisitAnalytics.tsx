import Script from 'next/script';

const LANDING_VISIT_ANALYTICS_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
// The site token is public in the Landing HTML; a value outside letters and digits is ignored.
const LANDING_VISIT_ANALYTICS_TOKEN_PATTERN = /^[A-Za-z0-9]{1,64}$/u;

// Landing visit analytics (Cloudflare Web Analytics). Only `LandingScreen` renders it, so the
// script loads on `/` alone; `spa: false` keeps client navigations after the Landing out of the
// beacon. Without a valid build-time token nothing is rendered. Purpose, items and retention:
// docs/architecture/decisions/security-privacy.md `sec.privacy.landing-visit-analytics`.
export function LandingVisitAnalytics() {
  // A literal `process.env.NEXT_PUBLIC_*` read so Next.js inlines the value at build time
  // (build-public key in src/config/env.schema.ts).
  const token = process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();
  if (token === undefined || !LANDING_VISIT_ANALYTICS_TOKEN_PATTERN.test(token)) return null;

  return (
    <Script
      src={LANDING_VISIT_ANALYTICS_SRC}
      strategy="afterInteractive"
      defer
      data-cf-beacon={JSON.stringify({ token, spa: false })}
    />
  );
}
