import { useLayoutEffect, type RefObject } from 'react';
import { prefersReducedMotion } from './useReducedMotion';

// Each section below the visible area enters on its own: on the first scroll, sections still below the
// enter line become pending (data-pending) and settle when they reach it. Nothing is pending before
// the visitor scrolls, so the loaded page and its accessibility checks see every section as it ends
// up. Reduced motion stays static. Styling reads the attribute through group-data-pending
// variants (styles/tokens/utilities.css).
export function useSectionReveal(rootRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) return;

    let pending: HTMLElement[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.removeAttribute('data-pending');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    );
    const arm = () => {
      const enterLine = window.innerHeight * 0.85;
      pending = [...root.querySelectorAll<HTMLElement>('[data-reveal-section]')].filter(
        (section) => section.getBoundingClientRect().top > enterLine,
      );
      for (const section of pending) {
        section.setAttribute('data-pending', '');
        observer.observe(section);
      }
    };
    window.addEventListener('scroll', arm, { once: true, passive: true });
    return () => {
      window.removeEventListener('scroll', arm);
      observer.disconnect();
      for (const section of pending) section.removeAttribute('data-pending');
    };
  }, [rootRef]);
}
