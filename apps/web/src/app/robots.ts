import type { MetadataRoute } from 'next';
import { createPublicUrl, type PublicMetadataEnv } from './metadata';

export const PUBLIC_ROBOTS_DISALLOW = ['/api/', '/main', '/main/'] as const;

export function createRobots(rawEnv: PublicMetadataEnv = process.env): MetadataRoute.Robots {
  const siteUrl = new URL(createPublicUrl('/', rawEnv));

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...PUBLIC_ROBOTS_DISALLOW],
    },
    sitemap: createPublicUrl('/sitemap.xml', rawEnv),
    host: siteUrl.origin,
  };
}

export default function robots(): MetadataRoute.Robots {
  return createRobots();
}
