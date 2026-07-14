import type { ElementType } from 'react';
import { RANGE_FRAME_CLASS, RANGE_TEXT_CLASS } from '../axisTone';
import type { CompatibilityBucketTone } from '../types';
import {
  TwoLaneOptionItem,
  type TwoLaneOption,
  type TwoLaneSupportLevel,
} from './TwoLaneOptionItem';

interface TwoLaneNote {
  readonly text: string;
  readonly Icon?: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
}

export function TwoLaneRangeCard<TId extends string>({
  title,
  targetUsageLabel,
  rangeTone,
  targetKind,
  viewerLabel,
  supportByKind,
  options,
  note,
}: {
  readonly title: string;
  readonly targetUsageLabel: string;
  readonly rangeTone: CompatibilityBucketTone;
  readonly targetKind: TId;
  readonly viewerLabel: string;
  readonly supportByKind: Partial<Record<TId, TwoLaneSupportLevel>>;
  readonly options: readonly TwoLaneOption<TId>[];
  readonly note?: TwoLaneNote | null;
}) {
  const getSupportLevel = (id: TId) => supportByKind[id] ?? 'outside';
  const acceptedOptions = options.filter((option) => getSupportLevel(option.id) !== 'outside');
  const outsideOptions = options.filter((option) => getSupportLevel(option.id) === 'outside');
  const NoteIcon = note?.Icon;

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm"
      aria-label={`${title} 2-lane`}
    >
      <p className="text-[11px] font-extrabold leading-4 text-slate-900">{title}</p>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className={`text-[10px] font-extrabold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}>
            나의 조건 범위
          </p>
          <p
            className={`text-right text-[10px] font-bold leading-4 ${RANGE_TEXT_CLASS[rangeTone]}`}
          >
            {viewerLabel}
          </p>
        </div>
        <ul className="grid gap-1.5" aria-label={`${title} 상대방 상태`}>
          {acceptedOptions.length > 0 ? (
            <li
              className={`rounded-2xl border-2 p-1.5 ${RANGE_FRAME_CLASS[rangeTone]}`}
              aria-label={`${title} 나의 조건 범위`}
            >
              <p className="mb-1 px-1 text-[10px] font-extrabold leading-4 text-slate-600">
                {targetUsageLabel}
              </p>
              <ul className="grid gap-1.5">
                {acceptedOptions.map((option) => (
                  <TwoLaneOptionItem
                    key={option.id}
                    option={option}
                    active={option.id === targetKind}
                    supportLevel={getSupportLevel(option.id)}
                  />
                ))}
              </ul>
            </li>
          ) : null}
          {outsideOptions.map((option) => (
            <TwoLaneOptionItem
              key={option.id}
              option={option}
              active={option.id === targetKind}
              supportLevel={getSupportLevel(option.id)}
            />
          ))}
        </ul>
      </div>

      {note ? (
        <div
          className={`mt-2 rounded-2xl border border-sky-100 bg-sky-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-sky-700 ${
            NoteIcon ? 'flex items-start gap-1.5' : ''
          }`}
        >
          {NoteIcon ? (
            <NoteIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />
          ) : null}
          <span>{note.text}</span>
        </div>
      ) : null}
    </div>
  );
}

export type { TwoLaneOption, TwoLaneSupportLevel };
