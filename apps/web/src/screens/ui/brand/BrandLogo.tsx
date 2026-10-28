import Image from 'next/image';
import logoMarkWhite from './art/logo-mark-white.png';
import logoMark from './art/logo-mark.png';

// The bear-house mark: made by the Owner with ChatGPT image generation (GPT-6 High) on 2026-10-23 and
// 24, an original bear with no school mascot, name or colors. The files here are smaller copies of the
// Owner's originals. The white cut is for dark surfaces.
const logoMarks = { color: logoMark, white: logoMarkWhite };

export type BrandLogoTone = keyof typeof logoMarks;
export type BrandLogoSize = 'md' | 'lg';

// width/height are the drawn mark size in px for next/image; the classes set the same size in CSS.
// md is the header size, lg the footer size.
const sizes = {
  md: { mark: 28, markClass: 'size-7', letteringClass: 'h-8' },
  lg: { mark: 40, markClass: 'size-10', letteringClass: 'h-12' },
} satisfies Record<BrandLogoSize, { mark: number; markClass: string; letteringClass: string }>;

// The service logo: the mark, then the hand-drawn 돔두리 over dormduri. The mark is decorative and the
// lettering carries the one name, 돔두리 (the Latin line spells the same name). 돔 and the Latin line take
// the brand color, 두리 the surrounding text color, so the logo follows the palette it sits in.
export function BrandLogo({
  tone = 'color',
  size = 'md',
}: {
  tone?: BrandLogoTone;
  size?: BrandLogoSize;
}) {
  const { mark, markClass, letteringClass } = sizes[size];
  return (
    <span className="flex shrink-0 items-center gap-2">
      <Image src={logoMarks[tone]} alt="" width={mark} height={mark} className={markClass} />
      <BrandLettering className={`${letteringClass} w-auto`} />
    </span>
  );
}

// Paths from the Owner's chosen draft J: rounded strokes on a 150-unit Hangul grid, the Latin line
// scaled to the Hangul width under it.
function BrandLettering({ className }: { className: string }) {
  return (
    <svg
      role="img"
      aria-label="돔두리"
      viewBox="-8 -10 352 261.43"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="fill-none" strokeLinecap="round" strokeLinejoin="round">
        <g className="stroke-fg-brand" strokeWidth={15}>
          <path d="M84 6 H30 Q14 6 14 18 Q14 30 30 30 H84" />
          <path d="M50 48 V68" />
          <path d="M4 88 L38 73.2 Q50 68 62 73.2 L96 88" />
          <path d="M31 102 H69 Q82 102 82 115 V129 Q82 142 69 142 H31 Q18 142 18 129 V115 Q18 102 31 102 Z" />
        </g>
        <g className="stroke-current" strokeWidth={15}>
          <path d="M204 8 H152 Q136 8 136 24 V38 Q136 54 152 54 H204" />
          <path d="M126 80 H214 M170 80 V142" />
          <path d="M248 9 H286 Q300 9 300 23 V60 Q300 74 286 74 H264 Q250 74 250 88 V126 Q250 140 264 140 H302" />
          <path d="M328 8 V142" />
        </g>
        <g className="stroke-fg-brand" strokeWidth={16} transform="translate(0 176) scale(0.5714)">
          <path d="M35 47 A28 28 0 1 0 35 103 A28 28 0 1 0 35 47 Z M63 7 V110" />
          <path d="M121 47 A28 28 0 1 0 121 103 A28 28 0 1 0 121 47 Z" />
          <path d="M179 47 V110 M179 75 A28 28 0 0 1 207 47" />
          <path d="M237 47 V110 M237 68 A21 21 0 0 1 279 68 V110 M279 68 A21 21 0 0 1 321 68 V110" />
          <path d="M379 47 A28 28 0 1 0 379 103 A28 28 0 1 0 379 47 Z M407 7 V110" />
          <path d="M437 47 V82 A28 28 0 0 0 493 82 M493 47 V110" />
          <path d="M523 47 V110 M523 75 A28 28 0 0 1 551 47" />
          <path d="M581 47 V110" />
          <circle cx="581" cy="17" r="9" className="fill-fg-brand stroke-none" />
        </g>
      </g>
    </svg>
  );
}
