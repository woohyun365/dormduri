'use client';

import {
  ROOMMATE_CONDITION_FIELDS,
  formatLifestyleFieldName,
  type LifestyleDisplayField,
} from '@repo/shared/lifestyle';
import {
  AlarmClock,
  AudioLines,
  Cigarette,
  CigaretteOff,
  Ear,
  Headphones,
  Moon,
  Phone,
  PhoneOff,
  Smartphone,
  Sparkles,
  SprayCan,
  SunDim,
  Thermometer,
  Users,
  Utensils,
  UtensilsCrossed,
  Volume1,
  Volume2,
  Wine,
  WineOff,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { ComparePair } from '../model/demoData';
import { pairSheets } from '../model/landingCopy';

// The fields the service compares, as icon coins on two sheets the visitor lays together, under the
// statement after 무엇이 다른가요. The sheet title says 생활패턴 적합도 like the rest of the page. The
// sheets hold the 12 public comparison pairs in the same places: 나 (my answers: my own habits and what
// I accept from a roommate) and 상대 (the other person's habits). Dragging the 상대 card onto mine, or
// the button (also the keyboard's way), brings each pair together (내 잠귀 with 상대 잠버릇, 취침 시간
// with 취침 시간); a drag stays where it was let go. Phones use the button only and give the coins more
// room (3 columns until lg). A pair's second name hangs under the first with ↕ on the line between.
// --overlap (0 apart, 1 met) drives the sheets, the coins and the names (pair-* utilities). Stacked, my
// sheet stays put and the 상대 sheet comes all the way up onto it while the gap under it closes; the
// page keeps the pressed button where it was, so the met sheets show right above it instead of
// scrolling off the top (Owner 2026-11-04, feedback 2).

const fieldIcons: Record<LifestyleDisplayField, LucideIcon> = {
  bedtime: Moon,
  wakeTime: AlarmClock,
  sleepHabit: AudioLines,
  sleepEnvironment: Volume2,
  screenUsage: Smartphone,
  noiseSensitivity: Ear,
  smokingBehavior: Cigarette,
  indoorEating: UtensilsCrossed,
  phoneBehavior: Phone,
  earphoneUsage: Headphones,
  cleanLevel: Sparkles,
  drinkingFrequency: Wine,
  relationshipStyle: Users,
  temperatureSensitivity: Thermometer,
  smokingTolerance: CigaretteOff,
  indoorEatingTolerance: Utensils,
  phoneTolerance: PhoneOff,
  earphoneExpectation: Headphones,
  cleanExpectation: SprayCan,
  drinkingTolerance: WineOff,
  sleepEnvPreference: Volume1,
  screenTolerance: SunDim,
};

const conditionFields: readonly LifestyleDisplayField[] = ROOMMATE_CONDITION_FIELDS;

// My habits filled, my conditions outlined; the other person's coins in brand outline, opaque so the
// one on top reads as on top.
const coinLook = {
  habit: 'border-stroke-subtle bg-layer-floating text-fg-neutral',
  condition: 'border-2 border-brand-stroke bg-layer-default text-fg-brand',
  theirs: 'border-2 border-brand-solid bg-layer-default text-fg-brand depth-card',
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function Sheet({
  side,
  pairs,
  sheetRef,
  className = '',
  style,
  ...handlers
}: {
  side: 'mine' | 'theirs';
  pairs: readonly ComparePair[];
  sheetRef: RefObject<HTMLDivElement | null>;
  className?: string;
  style?: CSSProperties;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
  onLostPointerCapture?: () => void;
}) {
  const mine = side === 'mine';
  const copy = mine ? pairSheets.mine : pairSheets.theirs;
  // What would print over the other sheet once they meet fades out on the moving one.
  const fade = mine ? '' : 'pair-fade';
  return (
    // Same border width on both, so the sheets line up exactly once met.
    <div
      ref={sheetRef}
      className={`flex flex-col gap-3 rounded-sheet p-3 ${
        mine
          ? 'border-2 border-stroke-subtle bg-layer-default depth-card'
          : 'z-10 border-2 border-dashed border-brand-stroke'
      } ${className}`}
      style={style}
      {...handlers}
    >
      <p className={`flex flex-col text-left ${fade}`}>
        <span className="text-body-sm font-bold">{copy.title}</span>
        <span className="text-label text-fg-muted">{copy.note}</span>
      </p>
      <ul aria-label={copy.listLabel} className="grid grid-cols-3 gap-x-4 gap-y-5 lg:grid-cols-4">
        {pairs.map((pair, index) => {
          const field = mine ? pair.mine : pair.theirs;
          const Icon = fieldIcons[field];
          const same = pair.mine === pair.theirs;
          const look = mine
            ? conditionFields.includes(field)
              ? coinLook.condition
              : coinLook.habit
            : coinLook.theirs;
          return (
            <li key={pair.axis} className="flex h-36 w-20 flex-col items-center gap-1.5 pt-1">
              <span
                className="block float-bob"
                // 25ms between coins, not the stagger token: 24 coins at 80ms would take two seconds.
                style={{
                  animationDelay: `calc(var(--duration-band) + ${(index + (mine ? 0 : pairs.length)) * 25}ms)`,
                }}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-12 items-center justify-center rounded-full ${look} ${
                    mine ? 'pair-coin-mine' : 'pair-coin-theirs'
                  }`}
                >
                  <Icon className="size-5" />
                </span>
              </span>
              <span
                className={`text-center text-label font-bold break-keep ${
                  mine ? 'text-fg-neutral' : `text-fg-brand ${fade}`
                }`}
              >
                {formatLifestyleFieldName(field)}
              </span>
              {mine ? (
                <>
                  {/* A same-field pair needs no second name. */}
                  {same ? null : (
                    // The arrow on a line of its own between the two names.
                    <span
                      aria-hidden="true"
                      className="flex flex-col items-center text-center text-label break-keep text-fg-brand pair-show"
                    >
                      <span>↕</span>
                      <span>{formatLifestyleFieldName(pair.theirs)}</span>
                    </span>
                  )}
                  <span className="sr-only">
                    , {pairSheets.theirs.fieldPrefix} {formatLifestyleFieldName(pair.theirs)}
                  </span>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StatementFields({ pairs }: { pairs: readonly ComparePair[] }) {
  const [overlap, setOverlap] = useState(0);
  const [dragging, setDragging] = useState(false);
  // The status line speaks only after the visitor moves the cards: on load it switches from the tap line
  // to the drag line once the sheets are measured, and that switch is not news.
  const [moved, setMoved] = useState(false);
  // From the 상대 sheet's place to mine (offset* leave the sheets' own translate out): side by side
  // from lg, stacked below it.
  const [to, setTo] = useState({ x: 0, y: 0 });
  const mineRef = useRef<HTMLDivElement>(null);
  const theirsRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; from: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const mine = mineRef.current;
      const theirs = theirsRef.current;
      if (!mine || !theirs) return;
      setTo({ x: mine.offsetLeft - theirs.offsetLeft, y: mine.offsetTop - theirs.offsetTop });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (mineRef.current?.parentElement) observer.observe(mineRef.current.parentElement);
    return () => observer.disconnect();
  }, []);

  // Each sheet travels half the way, so they meet in the middle; the pointer moves the 상대 sheet.
  // Only side by side (lg): stacked, a drag would run along the page scroll, so phones use the
  // button.
  const side = to.y === 0 && to.x !== 0;
  // Stacked: my sheet keeps its place and the 상대 sheet travels the whole way; the margin under it
  // shrinks by the same distance, so no empty band is left where it was.
  const stacked = to.y !== 0;
  const mineStyle = stacked ? ({ '--to-x': '0px', '--to-y': '0px' } as CSSProperties) : undefined;
  const theirsStyle = stacked
    ? ({
        '--to-x': `${to.x * 2}px`,
        '--to-y': `${to.y * 2}px`,
        marginBottom: `calc(var(--overlap) * ${to.y}px)`,
      } as CSSProperties)
    : undefined;
  // While the gap closes or opens (pair-ease, --duration-band 720ms), keep the pressed button at the same
  // place on screen every frame: the page scroll and the closing gap then move as one and nothing below
  // jumps. Instant, because the page's smooth scroll-behavior would lag the correction; browser scroll
  // anchoring is off meanwhile so it does not correct twice.
  const keepInPlace = (anchor: HTMLElement) => {
    if (!stacked) return;
    const root = document.documentElement;
    const start = anchor.getBoundingClientRect().top;
    const until = performance.now() + 1000;
    root.style.overflowAnchor = 'none';
    const step = () => {
      const drift = anchor.getBoundingClientRect().top - start;
      if (drift !== 0) window.scrollBy({ top: drift, behavior: 'instant' });
      if (performance.now() < until) requestAnimationFrame(step);
      else root.style.overflowAnchor = '';
    };
    requestAnimationFrame(step);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !side) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, from: overlap };
    setDragging(true);
    setMoved(true);
  };
  const onPointerEnd = () => {
    drag.current = null;
    setDragging(false);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const length = to.x * to.x + to.y * to.y;
    if (!start || !length) return;
    // Only while the button is held: a release the page never heard (let go outside
    // the frame) ends the drag at the next move instead of the card following a bare hover.
    if ((event.buttons & 1) === 0) {
      onPointerEnd();
      return;
    }
    const along = (event.clientX - start.x) * to.x + (event.clientY - start.y) * to.y;
    setOverlap(clamp(start.from + along / (length / 2)));
  };

  const met = overlap >= 1;
  const state = met ? 'met' : overlap <= 0 ? 'apart' : 'partway';
  const style = {
    '--overlap': overlap,
    '--to-x': `${to.x}px`,
    '--to-y': `${to.y}px`,
  } as CSSProperties;
  return (
    <div
      style={style}
      className={`mx-auto mt-12 flex w-full max-w-page flex-col items-center gap-6 px-gutter-safe ${
        dragging ? '' : 'pair-ease'
      }`}
    >
      <p className="text-label font-bold text-fg-muted">
        {pairSheets.title} · {`${pairs.length}${pairSheets.pairUnit}`}
      </p>
      <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-16">
        <Sheet
          side="mine"
          pairs={pairs}
          sheetRef={mineRef}
          className="pair-sheet-mine"
          style={mineStyle}
        />
        <Sheet
          side="theirs"
          pairs={pairs}
          sheetRef={theirsRef}
          style={theirsStyle}
          className={`pair-sheet-theirs touch-pan-y select-none ${
            dragging ? 'cursor-grabbing' : side ? 'cursor-grab' : ''
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            setOverlap(met ? 0 : 1);
            setMoved(true);
            keepInPlace(event.currentTarget);
          }}
          className="inline-flex min-h-target-min items-center rounded-full border border-stroke-neutral px-4 text-body-sm font-bold transition-colors hover:border-brand-solid hover:bg-brand-solid hover:text-fg-on-brand focus-visible:focus-ring"
        >
          {met ? pairSheets.part : pairSheets.join}
        </button>
        <p aria-live={moved ? 'polite' : 'off'} className="text-label text-fg-muted">
          {state === 'apart' && !side ? pairSheets.status.apartTap : pairSheets.status[state]}
        </p>
      </div>
    </div>
  );
}
