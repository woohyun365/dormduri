import logoMark from './art/logo-mark.png';

// A copy of the user Web logo (apps/web/src/screens/ui/brand/BrandLogo.tsx: lettering paths at f594b4f0, art at 0ddf3caf,
// design guide ⑧) with a '백오피스' mark. The mark is a static import drawn as a plain <img> with its src, width and
// height: next/image and getImageProps would add an inline style that the backoffice CSP blocks (README §5).

/** The service logo with the '백오피스' mark after a divider: the sidebar, the narrow top bar and the sign-in card. */
export function BrandLogo() {
  const image = logoMark;
  return (
    <span className="flex shrink-0 items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed small mark; next/image would add an inline style (CSP). */}
      <img src={image.src} width={image.width} height={image.height} alt="" className="size-7" />
      <BrandLettering className="h-8 w-auto" />
      <span className="flex items-center gap-2 text-body font-semibold text-shell-fg">
        <span aria-hidden="true" className="h-4 w-px bg-shell-stroke" />
        백오피스
      </span>
    </span>
  );
}

/** The mark alone (a collapsed sidebar); the name stays for assistive technology. */
export function BrandMark() {
  const image = logoMark;
  return (
    <span className="flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed small mark; next/image would add an inline style (CSP). */}
      <img src={image.src} width={image.width} height={image.height} alt="" className="size-8" />
      <span className="sr-only">돔두리 백오피스</span>
    </span>
  );
}

// Paths copied from the user Web BrandLettering.
function BrandLettering({ className }: { readonly className: string }) {
  return (
    <svg
      role="img"
      aria-label="돔두리"
      viewBox="-8 -10 352 261.43"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="fill-none" strokeLinecap="round" strokeLinejoin="round">
        <g className="stroke-logo-brand" strokeWidth={15}>
          <path d="M84 6 H30 Q14 6 14 18 Q14 30 30 30 H84" />
          <path d="M50 48 V68" />
          <path d="M4 88 L38 73.2 Q50 68 62 73.2 L96 88" />
          <path d="M31 102 H69 Q82 102 82 115 V129 Q82 142 69 142 H31 Q18 142 18 129 V115 Q18 102 31 102 Z" />
        </g>
        <g className="stroke-logo-ink" strokeWidth={15}>
          <path d="M204 8 H152 Q136 8 136 24 V38 Q136 54 152 54 H204" />
          <path d="M126 80 H214 M170 80 V142" />
          <path d="M248 9 H286 Q300 9 300 23 V60 Q300 74 286 74 H264 Q250 74 250 88 V126 Q250 140 264 140 H302" />
          <path d="M328 8 V142" />
        </g>
        <g
          className="stroke-logo-brand"
          strokeWidth={16}
          transform="translate(0 176) scale(0.5714)"
        >
          <path d="M35 47 A28 28 0 1 0 35 103 A28 28 0 1 0 35 47 Z M63 7 V110" />
          <path d="M121 47 A28 28 0 1 0 121 103 A28 28 0 1 0 121 47 Z" />
          <path d="M179 47 V110 M179 75 A28 28 0 0 1 207 47" />
          <path d="M237 47 V110 M237 68 A21 21 0 0 1 279 68 V110 M279 68 A21 21 0 0 1 321 68 V110" />
          <path d="M379 47 A28 28 0 1 0 379 103 A28 28 0 1 0 379 47 Z M407 7 V110" />
          <path d="M437 47 V82 A28 28 0 0 0 493 82 M493 47 V110" />
          <path d="M523 47 V110 M523 75 A28 28 0 0 1 551 47" />
          <path d="M581 47 V110" />
          <circle cx="581" cy="17" r="9" className="fill-logo-brand stroke-none" />
        </g>
      </g>
    </svg>
  );
}
