import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingScreen } from '../LandingScreen';
import { beforeStack, heroAsk, landingCopy, landingSectionIds } from '../model/landingCopy';
import { LANDING_POLICY_COPY, LANDING_SURFACE_SECTION_IDS } from '../model/landingPolicyCopy';

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

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
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
  vi.stubGlobal('IntersectionObserver', NoopObserver);
  vi.stubGlobal('ResizeObserver', NoopObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The page's own header and footer: the community post window has an article header and footer too,
// which jsdom also counts as banner and contentinfo.
function pageLandmark(role: 'banner' | 'contentinfo') {
  const [landmark, ...others] = screen
    .getAllByRole(role)
    .filter((element) => !element.closest('article'));
  expect(others, role).toHaveLength(0);
  return landmark!;
}

const linksTo = (href: string) =>
  screen.getAllByRole('link').filter((link) => link.getAttribute('href') === href);

describe('LandingScreen', () => {
  it('shows each policy notice in every surface its contract requires', () => {
    render(<LandingScreen />);

    for (const notice of LANDING_POLICY_COPY) {
      for (const surface of notice.requiredSurface) {
        const area = document.getElementById(LANDING_SURFACE_SECTION_IDS[surface]);
        expect(area, `${notice.id} needs #${LANDING_SURFACE_SECTION_IDS[surface]}`).not.toBeNull();
        expect(
          within(area!).getAllByText(new RegExp(escape(notice.testAnchor))).length,
          `${notice.id} in ${surface}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('keeps one page header, one main and one page footer, with the hero title as the only h1', () => {
    render(<LandingScreen />);

    expect(pageLandmark('banner').tagName).toBe('HEADER');
    expect(pageLandmark('contentinfo').tagName).toBe('FOOTER');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const { lead, accent, rest } = landingCopy.heroTitle;
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${lead} ${accent}${rest}`);
  });

  it('names the sign-up action one way and sends it to /signup; the header keeps its short name', () => {
    render(<LandingScreen />);

    // Every link to an action carries that action's one name, wherever it is and however many there are.
    const header = pageLandmark('banner');
    const signups = linksTo('/signup');
    expect(signups.length).toBeGreaterThan(0);
    for (const link of signups) {
      expect(link).toHaveAccessibleName(
        header.contains(link) ? landingCopy.startLabel : landingCopy.primaryCtaLabel,
      );
    }
    expect(within(header).getByRole('link', { name: landingCopy.startLabel })).toHaveAttribute(
      'href',
      '/signup',
    );
    const hero = document.getElementById(LANDING_SURFACE_SECTION_IDS.hero)!;
    expect(within(hero).getByRole('link', { name: landingCopy.primaryCtaLabel })).toHaveAttribute(
      'href',
      '/signup',
    );
    const logins = linksTo('/login');
    expect(logins.length).toBeGreaterThan(0);
    for (const link of logins) expect(link).toHaveAccessibleName(landingCopy.loginLabel);
  });

  it('links the header logo home under the service name; the footer logo stays a picture', () => {
    render(<LandingScreen />);

    expect(within(pageLandmark('banner')).getByRole('link', { name: '돔두리' })).toHaveAttribute(
      'href',
      '/',
    );
    const footer = pageLandmark('contentinfo');
    expect(within(footer).getByRole('img', { name: '돔두리' })).toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: '돔두리' })).toBeNull();
  });

  it('gives every hero question a section to go to and moves focus there with the view', () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<LandingScreen />);

      for (const { target } of heroAsk.items) {
        const section = document.getElementById(landingSectionIds[target]);
        expect(section, target).not.toBeNull();
        expect(section, target).toHaveAttribute('tabindex', '-1');
      }
      const hero = document.getElementById(LANDING_SURFACE_SECTION_IDS.hero)!;
      // Reduced motion keeps the first question on the box.
      fireEvent.click(
        within(hero).getByRole('button', { name: new RegExp(escape(heroAsk.goLabel)) }),
      );
      const first = document.getElementById(landingSectionIds[heroAsk.items[0].target]);
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(first);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('links the terms and privacy pages and shows the external inquiry address as text', () => {
    render(<LandingScreen />);

    const footer = pageLandmark('contentinfo');
    expect(
      within(footer).getByRole('link', { name: landingCopy.footer.termsLabel }),
    ).toHaveAttribute('href', '/terms');
    expect(
      within(footer).getByRole('link', { name: landingCopy.footer.privacyLabel }),
    ).toHaveAttribute('href', '/privacy');
    const address = footer.querySelector('address');
    expect(address).not.toBeNull();
    expect(address).toHaveTextContent(landingCopy.footer.inquiryAddress);
    expect(address!.querySelector('a')).toBeNull();
  });

  it('marks the example community post as an example', () => {
    render(<LandingScreen />);

    const post = screen.getByRole('article');
    expect(within(post).getByRole('heading', { level: 3 })).toHaveTextContent(
      landingCopy.exampleTag,
    );
  });

  it('brings a 무엇이 다른가요 window to the front only with its switch, not by hover or a tap on it', () => {
    render(<LandingScreen />);

    const switches = screen.getByRole('group', { name: beforeStack.switchLabel });
    const postSwitch = within(switches).getByRole('button', { name: beforeStack.labels.post });
    const serviceSwitch = within(switches).getByRole('button', {
      name: beforeStack.labels.service,
    });
    // The window that holds the post; data-back marks the window behind.
    const postWindow = screen.getByRole('article').closest('[data-back]');
    expect(postWindow).not.toBeNull();

    // A finger dragging the page down over the post must leave the service window in front.
    fireEvent.mouseEnter(postWindow!);
    fireEvent.pointerDown(postWindow!);
    fireEvent.click(postWindow!);
    expect(serviceSwitch).toHaveAttribute('aria-pressed', 'true');
    expect(postWindow).toHaveAttribute('data-back');

    fireEvent.click(postSwitch);
    expect(postSwitch).toHaveAttribute('aria-pressed', 'true');
    expect(postWindow).not.toHaveAttribute('data-back');
  });

  it('calls no runtime API and shows no internal wording', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = render(<LandingScreen />);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/draft|scope|capability|registration|round-\d/i);
  });
});
