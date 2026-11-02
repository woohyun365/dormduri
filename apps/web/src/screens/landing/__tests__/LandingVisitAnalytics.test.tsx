import { render } from '@testing-library/react';
import type { ImgHTMLAttributes, ScriptHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingScreen } from '../LandingScreen';

type ImageSource = string | { src: string };
const srcOf = (src: ImageSource) => (typeof src === 'string' ? src : src.src);

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: ImageSource }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={srcOf(src)} alt={alt} className={className} />
  ),
  getImageProps: ({ src, alt, sizes }: { src: ImageSource; alt: string; sizes?: string }) => ({
    props: { src: srcOf(src), srcSet: srcOf(src), alt, sizes },
  }),
}));

// next/script injects the element after hydration; the mock renders what it receives so the test
// reads the props the Landing passes.
vi.mock('next/script', () => ({
  default: ({
    strategy,
    ...props
  }: ScriptHTMLAttributes<HTMLScriptElement> & { strategy?: string }) => (
    <script data-strategy={strategy} {...props} />
  ),
}));

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const TOKEN_KEY = 'NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN';

function analyticsScripts(container: HTMLElement) {
  return container.querySelectorAll('script[src*="cloudflareinsights"]');
}

describe('Landing visit analytics', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', NoopObserver);
    vi.stubGlobal('ResizeObserver', NoopObserver);
    // Reduced motion keeps the question box still, so the render is stable.
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders no analytics script without a token', () => {
    vi.stubEnv(TOKEN_KEY, '');

    const { container } = render(<LandingScreen />);

    expect(analyticsScripts(container)).toHaveLength(0);
  });

  it('loads the Cloudflare beacon once with SPA tracking off when a token is set', () => {
    vi.stubEnv(TOKEN_KEY, '0123456789abcdef0123456789abcdef');

    const { container } = render(<LandingScreen />);
    const scripts = analyticsScripts(container);

    expect(scripts).toHaveLength(1);
    const script = scripts[0]!;
    expect(script.getAttribute('src')).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(script.getAttribute('data-strategy')).toBe('afterInteractive');
    expect(script.hasAttribute('defer')).toBe(true);
    expect(JSON.parse(script.getAttribute('data-cf-beacon') ?? '{}')).toEqual({
      token: '0123456789abcdef0123456789abcdef',
      spa: false,
    });
  });

  it.each([
    ['quote injection', 'abc","spa":true,"x":"'],
    ['spaces only', '   '],
    ['too long', 'a'.repeat(65)],
  ])('ignores a malformed token (%s)', (_label, token) => {
    vi.stubEnv(TOKEN_KEY, token);

    const { container } = render(<LandingScreen />);

    expect(analyticsScripts(container)).toHaveLength(0);
  });
});
