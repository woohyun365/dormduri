// Class names the landing sections share.

export const container = 'mx-auto w-full max-w-content px-gutter';

// A section whose content enters on scroll (useSectionReveal on the page frame marks it pending).
export const revealSection = 'group';

// A section the hero question box moves focus to (tabIndex -1). It is not a control, so it draws no
// focus ring; the focus ring stays on the controls inside it.
export const targetSection = 'focus:outline-none';

// Scroll entrance: the content rises and sharpens from a transparent blur (Foundations/Motion); stagger
// with reveal-delay-* (transition delays).
export const soft =
  'reveal-soft group-data-pending:translate-y-7 group-data-pending:opacity-0 group-data-pending:blur-sm';
export const softDelay = [
  '',
  'reveal-delay-1',
  'reveal-delay-2',
  'reveal-delay-3',
  'reveal-delay-4',
];
