import type { PublicProfileCompatibilityAxisId } from '@repo/shared/profile/contract';
import type { CompatibilityAxis } from '../types';

export function SleepRhythmTimeSlotComparison({
  axes,
}: {
  readonly axes: readonly CompatibilityAxis[];
}) {
  const timeAxes = axes.filter((axis) => Boolean(TIME_SLOT_TIMELINE_CONFIG[axis.id]));
  if (timeAxes.length === 0) return null;

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="수면 리듬 시간대 비교"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-sky-700">취침 시간 / 기상 시간</p>
        <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
          시간대 비교
        </span>
      </div>
      <div className="mt-2 h-px bg-sky-100" aria-hidden="true" />
      <div className="mt-3 space-y-2">
        {timeAxes.map((axis) => (
          <TimeSlotTimeline key={axis.id} axis={axis} />
        ))}
      </div>
    </div>
  );
}

interface TimeSlotConfig {
  readonly slots: readonly {
    readonly label: string;
    readonly aliases: readonly string[];
  }[];
  readonly flexibleAliases?: readonly string[];
}

const TIME_SLOT_TIMELINE_CONFIG: Partial<Record<PublicProfileCompatibilityAxisId, TimeSlotConfig>> =
  {
    BEDTIME: {
      slots: [
        { label: '22시 이전', aliases: ['22시 이전'] },
        { label: '22~24시', aliases: ['22~24시'] },
        { label: '24~02시', aliases: ['24~02시'] },
        { label: '02시 이후', aliases: ['02시 이후', '2시 이후'] },
      ],
    },
    WAKE_TIME: {
      slots: [
        { label: '7시 이전', aliases: ['7시 이전'] },
        { label: '7~8시', aliases: ['7~8시'] },
        { label: '8~9시', aliases: ['8~9시'] },
        { label: '9~10시', aliases: ['9~10시'] },
        { label: '10시 이후', aliases: ['10시 이후'] },
      ],
      flexibleAliases: ['수업에 따라 유동적'],
    },
  };

function TimeSlotTimeline({ axis }: { readonly axis: CompatibilityAxis }) {
  const config = TIME_SLOT_TIMELINE_CONFIG[axis.id];
  if (!config) return null;

  const targetSlotIndex = findTimeSlotIndex(config, axis.comparison.targetText);
  const viewerSlotIndex = findTimeSlotIndex(config, axis.comparison.viewerText);
  const targetFlexible = isFlexibleTimeSlot(config, axis.comparison.targetText);
  const viewerFlexible = isFlexibleTimeSlot(config, axis.comparison.viewerText);
  const bothFlexible = targetFlexible && viewerFlexible;
  const desktopGridClass = config.slots.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-5';

  return (
    <div
      className="rounded-2xl border border-sky-100 bg-sky-50 p-2.5"
      aria-label={`${axis.label} 시간대 시각화`}
    >
      <p className="mb-2 text-[11px] font-bold text-sky-700">
        {axis.id === 'BEDTIME' ? '취침' : '기상'}
      </p>
      <div
        className={`rounded-2xl p-1 ${
          viewerFlexible
            ? 'border-2 border-solid border-indigo-300 bg-white'
            : targetFlexible
              ? 'border-2 border-solid border-sky-200 bg-white'
              : ''
        }`}
      >
        <div
          className={`relative rounded-xl ${
            bothFlexible ? 'border-2 border-solid border-sky-300 p-1' : ''
          }`}
        >
          <div className={`grid grid-cols-1 gap-1 ${desktopGridClass}`}>
            {config.slots.map((slot, index) => {
              const markers = [
                ...(targetSlotIndex === index ? ['상대'] : []),
                ...(viewerSlotIndex === index ? ['나'] : []),
              ];
              const slotClassName = getTimeSlotMarkerClassName(markers);

              return (
                <div
                  key={slot.label}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-2 py-1.5 text-left sm:block sm:min-h-14 sm:px-1.5 sm:text-center ${slotClassName}`}
                >
                  <p className="min-w-0 break-keep text-[10px] leading-4 font-bold whitespace-normal">
                    {slot.label}
                  </p>
                  {markers.length > 0 ? (
                    <div className="flex shrink-0 flex-col items-end gap-1 min-[360px]:flex-row min-[360px]:flex-wrap min-[360px]:justify-end sm:mt-1 sm:items-center sm:justify-center">
                      {markers.map((marker) => (
                        <span
                          key={marker}
                          className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
                            marker === '상대'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {marker}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {targetFlexible || viewerFlexible ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
          {targetFlexible ? (
            <span className="rounded-full border border-sky-100 bg-sky-100 px-2 py-1 text-sky-700">
              상대 · 유동 일정
            </span>
          ) : null}
          {viewerFlexible ? (
            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-indigo-700">
              나 · 유동 일정
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getTimeSlotMarkerClassName(markers: readonly string[]): string {
  const hasTarget = markers.includes('상대');
  const hasViewer = markers.includes('나');

  if (hasTarget && hasViewer) {
    return 'border-indigo-300 bg-white text-indigo-700 shadow-sm ring-2 ring-sky-200';
  }

  if (hasViewer) {
    return 'border-indigo-200 bg-white text-indigo-700 shadow-sm';
  }

  if (hasTarget) {
    return 'border-sky-200 bg-white text-sky-700 shadow-sm';
  }

  return 'border-slate-100 bg-white/60 text-slate-400';
}

function findTimeSlotIndex(config: TimeSlotConfig, value: string): number | null {
  const index = config.slots.findIndex((slot) =>
    slot.aliases.some((alias) => value.includes(alias)),
  );
  return index === -1 ? null : index;
}

function isFlexibleTimeSlot(config: TimeSlotConfig, value: string): boolean {
  return config.flexibleAliases?.some((alias) => value.includes(alias)) ?? false;
}
