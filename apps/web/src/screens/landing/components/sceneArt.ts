import closingDawnTall from './art/closing-dawn-tall.webp';
import closingDawnWide from './art/closing-dawn-wide.webp';
import heroNightTall from './art/hero-night-tall.webp';
import heroNightWide from './art/hero-night-wide.webp';
import logoMarkWhite from './art/logo-mark-white.png';
import logoMark from './art/logo-mark.png';

// The landing's pictures and logo, new assets the Owner allowed for this page: made by the Owner with
// ChatGPT image generation (GPT-6 High) on 2026-10-23 and 24, an original bear with no school mascot,
// name or colors. The files here are smaller copies of the Owner's originals.

// 1672×941 landscape and 941×1672 portrait cuts of one scene; the bears sit at the lower edges.
export const heroNight = { wide: heroNightWide, tall: heroNightTall };

// The same room at dawn on move-in day, 1916×821 and 1122×1402, center left calm and dark.
export const closingDawn = { wide: closingDawnWide, tall: closingDawnTall };

export type LogoTone = 'color' | 'white';

// Symbol only: the service name stays text next to it. The white cut is for dark surfaces.
export const logoMarks = { color: logoMark, white: logoMarkWhite } satisfies Record<
  LogoTone,
  unknown
>;
