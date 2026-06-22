import type { MetadataRoute } from 'next';
import { createPublicUrl, PUBLIC_SITEMAP_ROUTES, type PublicMetadataEnv } from './metadata';

export function createSitemap(rawEnv: PublicMetadataEnv = process.env): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: createPublicUrl(route.pathname, rawEnv),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return createSitemap();
}
