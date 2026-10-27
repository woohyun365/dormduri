'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion, usePrefersReducedMotion } from './useReducedMotion';
import { heroAsk, landingSectionIds, type LandingSectionId } from '../model/landingCopy';

// Hero question box, in place of a search bar, which could pass for a real main-page feature. It does
// not search. The box looks like an input in Glide's hero and cycles the questions; pressing it (or its
// enter key) goes to the section that answers the question it shows. The box alone, without chips or an answer
// card, keeps the first screen on the service and sign-up; the sign-up link stays the one primary
// action.

// Types a question out, holds it, erases it and moves on, like the input text in Glide's hero; after the
// last question the first one types again. It holds the whole question while the pointer or focus
// rests on the box (so its name does not change under a screen reader), and under reduced motion shows
// the first question whole. The typing times are script timers, outside the duration tokens
// (Foundations/Motion).
function useTypedCycle(texts: readonly string[], running: boolean) {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState({ index: 0, length: 0, erasing: false });
  const text = texts[step.index] ?? '';
  const moving = running && !reduced;
  useEffect(() => {
    if (!moving) return;
    const delay = step.erasing ? 35 : step.length >= text.length ? 1800 : 80;
    const timer = window.setTimeout(() => {
      setStep((value) => {
        if (value.erasing) {
          if (value.length > 0) return { ...value, length: value.length - 1 };
          return { index: (value.index + 1) % texts.length, length: 0, erasing: false };
        }
        return value.length >= (texts[value.index]?.length ?? 0)
          ? { ...value, erasing: true }
          : { ...value, length: value.length + 1 };
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [step, moving, text, texts]);
  return { index: step.index, text: moving ? text.slice(0, step.length) : text };
}

const questions = heroAsk.items.map((item) => item.question);

// Goes to the section that answers a question and moves focus there too, so keyboard and screen reader
// users go on from that section (WCAG 2.4.3). Reduced motion jumps instead of scrolling.
function goToSection(target: LandingSectionId) {
  const section = document.getElementById(landingSectionIds[target]);
  if (!section) return;
  section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  section.focus({ preventScroll: true });
}

export function HeroAsk({
  onGo = goToSection,
}: {
  /** Goes to the section that answers the question on screen; by default the page scrolls there and
   *  focus moves to it. */
  onGo?: (target: LandingSectionId) => void;
}) {
  const [resting, setResting] = useState(false);
  const [paused, setPaused] = useState(false);
  const typed = useTypedCycle(questions, !resting && !paused);
  const shown = heroAsk.items[typed.index] ?? heroAsk.items[0];
  // A prompt box that is one button. The typed question is decoration; the name says what pressing
  // does: go to the section of the question on screen. Under the pointer or focus its enter key and, under
  // the pointer, the pause toggle turn to the brand fill; color only, no lift. Below it in the middle,
  // the pause toggle, an icon only (WCAG 2.2.2: the moving text must be possible to keep still, also on
  // touch); paused, the box shows the whole question it was on. Under reduced motion nothing moves, so
  // the toggle is invisible but keeps its room, and the hero lays out the same in both settings (the
  // contrast sweep runs reduced).
  return (
    <div className="flex w-full max-w-reading flex-col items-center gap-2 pb-2">
      <button
        type="button"
        onClick={() => onGo(shown.target)}
        onMouseEnter={() => setResting(true)}
        onMouseLeave={() => setResting(false)}
        onFocus={() => setResting(true)}
        onBlur={() => setResting(false)}
        className="group flex min-h-target-primary w-full cursor-pointer items-center gap-2 rounded-full border border-stroke-subtle bg-layer-floating py-1.5 pr-1.5 pl-5 text-left text-body depth-window focus-visible:focus-ring"
      >
        <span className="sr-only">{`${shown.question} ${heroAsk.goLabel}`}</span>
        <span aria-hidden="true" className="truncate text-fg-muted">
          {typed.text}
        </span>
        <span aria-hidden="true" className="-ml-1.5 h-5 w-px shrink-0 bg-fg-neutral" />
        <span
          aria-hidden="true"
          className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full border border-stroke-neutral transition-colors group-hover:border-brand-solid group-hover:bg-brand-solid group-hover:text-fg-on-brand group-focus-visible:border-brand-solid group-focus-visible:bg-brand-solid group-focus-visible:text-fg-on-brand"
        >
          {/* The enter key as a drawing, not the ↵ character: phone and tablet fonts drew its
              upright stroke too short. */}
          <svg viewBox="0 0 16 16" className="size-4 fill-none stroke-current">
            <path
              d="M12.5 2.5v5.5a2 2 0 0 1-2 2H3.5M6.5 7l-3 3 3 3"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-stroke-subtle bg-layer-floating depth-card transition-colors hover:border-brand-solid hover:bg-brand-solid hover:text-fg-on-brand focus-visible:focus-ring motion-reduce:invisible"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 fill-current">
          {paused ? <path d="M4 2.5v11l9.5-5.5z" /> : <path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" />}
        </svg>
        <span className="sr-only">{paused ? heroAsk.playLabel : heroAsk.pauseLabel}</span>
      </button>
    </div>
  );
}
