import type { PublicTextSurface } from './text-moderation.js';
export function toModerationSurfaceValue(surface: PublicTextSurface): 'NICKNAME' | 'INTRO' {
  switch (surface) {
    case 'nickname':
      return 'NICKNAME';
    case 'intro':
    case 'messageToRoommate':
      return 'INTRO';
  }
}
