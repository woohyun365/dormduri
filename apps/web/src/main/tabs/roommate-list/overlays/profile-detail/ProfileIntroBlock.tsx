import { useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';

const INTRO_PREVIEW_LINE_COUNT = 2;

export function ProfileIntroBlock({ intro }: { readonly intro: string }) {
  const [expandedIntro, setExpandedIntro] = useState<string | null>(null);
  const trimmedIntro = intro.trim();
  const introVisible = trimmedIntro.length > 0;
  const displayIntro = introVisible ? trimmedIntro : '-';
  const { measureRef, canExpand } = useRenderedLineOverflow({
    enabled: introVisible,
    lineCount: INTRO_PREVIEW_LINE_COUNT,
    text: displayIntro,
  });
  const expanded = expandedIntro === displayIntro;
  const introId = 'roommate-detail-intro';

  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur lg:p-5">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-blue-500" aria-hidden />
        <p className="text-xs font-bold text-slate-700">자기소개</p>
      </div>
      <div
        className={`rounded-2xl border px-4 py-3 ${
          introVisible ? 'border-blue-100 bg-blue-50/80' : 'border-slate-100 bg-slate-50'
        }`}
      >
        <div className="relative">
          <p
            ref={measureRef}
            aria-hidden="true"
            className={`invisible pointer-events-none absolute inset-x-0 top-0 -z-10 text-[13px] font-semibold leading-7 whitespace-normal sm:text-sm ${
              introVisible ? 'text-blue-950' : 'text-slate-500'
            }`}
          >
            {displayIntro}
          </p>
          <p
            id={introId}
            className={`text-[13px] font-semibold leading-7 sm:text-sm ${
              introVisible ? 'text-blue-950' : 'text-slate-500'
            } ${canExpand && !expanded ? 'line-clamp-2' : ''}`}
          >
            {displayIntro}
          </p>
          {canExpand && !expanded ? (
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-linear-to-t from-blue-50 via-blue-50/80 to-transparent"
              aria-hidden="true"
            />
          ) : null}
        </div>

        {canExpand ? (
          <button
            type="button"
            aria-controls={introId}
            aria-expanded={expanded}
            onClick={() =>
              setExpandedIntro((current) => (current === displayIntro ? null : displayIntro))
            }
            className="mt-3 inline-flex items-center rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
          >
            {expanded ? '자기소개 접기' : '자기소개 더 보기'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function useRenderedLineOverflow({
  enabled,
  lineCount,
  text,
}: {
  readonly enabled: boolean;
  readonly lineCount: number;
  readonly text: string;
}) {
  const measureRef = useRef<HTMLParagraphElement>(null);
  const [measuredCanExpand, setMeasuredCanExpand] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const element = measureRef.current;
    if (!element) return;

    const measure = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        setMeasuredCanExpand(false);
        return;
      }

      setMeasuredCanExpand(element.scrollHeight > lineHeight * lineCount + 1);
    };

    const frameId = window.requestAnimationFrame(measure);

    if (typeof window.ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener('resize', measure);
      };
    }

    const resizeObserver = new window.ResizeObserver(measure);
    resizeObserver.observe(element);
    if (element.parentElement) resizeObserver.observe(element.parentElement);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [enabled, lineCount, text]);

  return { measureRef, canExpand: enabled && measuredCanExpand };
}
