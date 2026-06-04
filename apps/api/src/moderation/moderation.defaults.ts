import type { PublicTextSurface } from './text-moderation.policy.js';
export function toModerationSurfaceValue(surface: PublicTextSurface): 'NICKNAME' | 'INTRO' {
  switch (surface) {
    case 'nickname':
      return 'NICKNAME';
    case 'intro':
    case 'matchRequestNote':
      return 'INTRO';
  }
}
