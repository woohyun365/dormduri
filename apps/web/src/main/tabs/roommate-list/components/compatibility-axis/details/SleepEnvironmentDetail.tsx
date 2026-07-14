import { Headphones, MonitorSmartphone, Moon, Volume2 } from 'lucide-react';
import type { ElementType } from 'react';
import { RANGE_FRAME_CLASS, RANGE_TEXT_CLASS } from '../axisTone';
import type { CompatibilityAxis, CompatibilityBucketTone } from '../types';

type SleepEnvironmentValueKind =
  | 'quiet'
  | 'earphone'
  | 'speaker'
  | 'noSpeaker'
  | 'speakerOk'
  | 'noScreen'
  | 'audio'
  | 'screen'
  | 'lowScreenOk'
  | 'screenOk'
  | 'unknown';

type SleepEnvironmentSupportLevel = 'match' | 'partial' | 'outside';

interface SleepEnvironmentCoordinationChannel {
  readonly id: 'sound' | 'screen';
  readonly title: string;
  readonly axis: CompatibilityAxis | undefined;
  readonly targetKind: SleepEnvironmentValueKind;
  readonly viewerKind: SleepEnvironmentValueKind;
}

export function SleepEnvironmentCoordinationCard({
  axes,
}: {
  readonly axes: readonly CompatibilityAxis[];
}) {
  const soundAxis = axes.find((axis) => axis.id === 'SLEEP_ENVIRONMENT');
  const screenAxis = axes.find((axis) => axis.id === 'SCREEN_USAGE');
  const channels = [
    {
      id: 'sound',
      title: '스피커 소리',
      axis: soundAxis,
      targetKind: inferSleepSoundTarget(soundAxis?.comparison.targetText),
      viewerKind: inferSleepSoundPreference(soundAxis?.comparison.viewerText),
    },
    {
      id: 'screen',
      title: '화면 밝기',
      axis: screenAxis,
      targetKind: inferSleepScreenTarget(screenAxis?.comparison.targetText),
      viewerKind: inferSleepScreenPreference(screenAxis?.comparison.viewerText),
    },
  ] as const satisfies readonly [
    SleepEnvironmentCoordinationChannel,
    SleepEnvironmentCoordinationChannel,
  ];

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="취침 전 수면 환경 조율 정보"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-50"
          aria-hidden="true"
        >
          <MonitorSmartphone className="h-3.5 w-3.5 text-sky-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">상대방의 기기 사용 방식</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            잘 때 화면·스피커 사용을 확인해요.
          </p>
        </div>
      </div>

      <SleepEnvironmentDeviceUsagePanel screenChannel={channels[1]} soundChannel={channels[0]} />
    </div>
  );
}

function SleepEnvironmentDeviceUsagePanel({
  screenChannel,
  soundChannel,
}: {
  readonly screenChannel: SleepEnvironmentCoordinationChannel;
  readonly soundChannel: SleepEnvironmentCoordinationChannel;
}) {
  return (
    <div className="mt-3 space-y-3" aria-label="상대방 기기 사용 비교">
      <SleepEnvironmentTwoLaneOverview screenChannel={screenChannel} soundChannel={soundChannel} />
    </div>
  );
}

interface SleepEnvironmentLaneOption {
  readonly id: SleepEnvironmentValueKind;
  readonly label: string;
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const SCREEN_USAGE_LANE_OPTIONS: readonly SleepEnvironmentLaneOption[] = [
  { id: 'noScreen', label: '안 봐요', Icon: Moon },
  { id: 'audio', label: '음악만 들어요', Icon: Headphones },
  { id: 'screen', label: '화면을 봐요', Icon: MonitorSmartphone },
];

const SLEEP_SOUND_LANE_OPTIONS: readonly SleepEnvironmentLaneOption[] = [
  { id: 'quiet', label: '무음', Icon: Moon },
  { id: 'earphone', label: '이어폰 사용', Icon: Headphones },
  { id: 'speaker', label: '스피커로 작게', Icon: Volume2 },
];

function SleepEnvironmentTwoLaneOverview({
  screenChannel,
  soundChannel,
}: {
  readonly screenChannel: SleepEnvironmentCoordinationChannel;
  readonly soundChannel: SleepEnvironmentCoordinationChannel;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-label="상대방 기기 사용 2-lane">
      <SleepEnvironmentLaneCard
        title="취침 시 화면 밝기"
        rangeTone={screenChannel.axis?.bucketTone ?? 'unknown'}
        targetKind={screenChannel.targetKind}
        viewerLabel={getSleepEnvironmentScreenPreferenceLabel(screenChannel.viewerKind)}
        supportByKind={getSleepEnvironmentScreenSupportByKind(screenChannel.viewerKind)}
        options={SCREEN_USAGE_LANE_OPTIONS}
        note={
          screenChannel.targetKind === 'audio' ? '음악만 듣는 경우는 화면 빛 없음으로 봐요.' : null
        }
      />
      <SleepEnvironmentLaneCard
        title="취침 시 스피커 사용"
        rangeTone={soundChannel.axis?.bucketTone ?? 'unknown'}
        targetKind={soundChannel.targetKind}
        viewerLabel={getSleepEnvironmentSoundPreferenceLabel(soundChannel.viewerKind)}
        supportByKind={getSleepEnvironmentSoundSupportByKind(soundChannel.viewerKind)}
        options={SLEEP_SOUND_LANE_OPTIONS}
        note={soundChannel.targetKind === 'earphone' ? '이어폰 사용은 무음과 같아요.' : null}
      />
    </div>
  );
}

function SleepEnvironmentLaneCard({
  title,
  rangeTone,
  targetKind,
  viewerLabel,
  supportByKind: supportConfig,
  options,
  note,
}: {
  readonly title: string;
  readonly rangeTone: CompatibilityBucketTone;
  readonly targetKind: SleepEnvironmentValueKind;
  readonly viewerLabel: string;
  readonly supportByKind: Partial<Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>>;
  readonly options: readonly SleepEnvironmentLaneOption[];
  readonly note: string | null;
}) {
  const supportByKind = Object.fromEntries(
    options.map((option) => [option.id, supportConfig[option.id] ?? 'outside']),
  ) as Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>;
  const acceptedOptions = options.filter((option) => supportByKind[option.id] !== 'outside');
  const outsideOptions = options.filter((option) => supportByKind[option.id] === 'outside');

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm"
      aria-label={`${title} 2-lane`}
    >
      <div>
        <p className="text-[11px] font-extrabold leading-4 text-slate-900">{title}</p>
      </div>

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
                {getSleepEnvironmentTargetUsageLabel(title)}
              </p>
              <ul className="grid gap-1.5">
                {acceptedOptions.map((option) => (
                  <SleepEnvironmentLaneOptionItem
                    key={option.id}
                    option={option}
                    active={option.id === targetKind}
                    supportLevel={supportByKind[option.id]}
                  />
                ))}
              </ul>
            </li>
          ) : null}
          {outsideOptions.map((option) => (
            <SleepEnvironmentLaneOptionItem
              key={option.id}
              option={option}
              active={option.id === targetKind}
              supportLevel={supportByKind[option.id]}
            />
          ))}
        </ul>
      </div>

      {note ? (
        <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-sky-700">
          {note}
        </div>
      ) : null}
    </div>
  );
}

function SleepEnvironmentLaneOptionItem({
  option,
  active,
  supportLevel,
}: {
  readonly option: SleepEnvironmentLaneOption;
  readonly active: boolean;
  readonly supportLevel: SleepEnvironmentSupportLevel;
}) {
  const Icon = option.Icon;
  const inRange = supportLevel !== 'outside';
  const itemClassName = active
    ? 'border-sky-300 bg-sky-50/90 text-sky-900 shadow-sm ring-1 ring-sky-200'
    : inRange
      ? 'border-indigo-100 bg-white/85 text-slate-700'
      : 'border-slate-100 bg-slate-50/70 text-slate-500';
  const iconClassName = active
    ? 'bg-white text-sky-700 ring-1 ring-sky-100'
    : 'bg-white/80 text-slate-400';

  return (
    <li
      className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 ${itemClassName}`}
      aria-current={active ? 'true' : undefined}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-keep text-[11px] leading-4 font-extrabold whitespace-normal">
        {option.label}
      </span>
      {active ? (
        <span className="ml-auto hidden shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 min-[361px]:inline-flex">
          상대
        </span>
      ) : null}
    </li>
  );
}

function getSleepEnvironmentTargetUsageLabel(title: string): string {
  return title.includes('화면') ? '상대의 화면 사용' : '상대의 스피커 사용';
}

function getSleepEnvironmentScreenSupportByKind(
  kind: SleepEnvironmentValueKind,
): Partial<Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>> {
  if (kind === 'screenOk') {
    return { noScreen: 'match', audio: 'match', screen: 'match' };
  }
  if (kind === 'lowScreenOk') {
    return { noScreen: 'match', audio: 'match', screen: 'partial' };
  }
  if (kind === 'noScreen') {
    return { noScreen: 'match', audio: 'match' };
  }
  return {};
}

function getSleepEnvironmentSoundSupportByKind(
  kind: SleepEnvironmentValueKind,
): Partial<Record<SleepEnvironmentValueKind, SleepEnvironmentSupportLevel>> {
  if (kind === 'speakerOk') {
    return { quiet: 'match', earphone: 'match', speaker: 'match' };
  }
  if (kind === 'noSpeaker') {
    return { quiet: 'match', earphone: 'match' };
  }
  return {};
}

function getSleepEnvironmentScreenPreferenceLabel(kind: SleepEnvironmentValueKind): string {
  if (kind === 'screenOk') return '화면 OK';
  if (kind === 'lowScreenOk') return '밝기 낮추면 OK';
  if (kind === 'noScreen') return '화면 끄기';
  return '화면 기준 확인 필요';
}

function getSleepEnvironmentSoundPreferenceLabel(kind: SleepEnvironmentValueKind): string {
  if (kind === 'speakerOk') return '작은 소리 OK';
  if (kind === 'noSpeaker') return '스피커 끄기';
  return '소리 기준 확인 필요';
}

function inferSleepSoundTarget(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('스피커')) return 'speaker';
  if (value.includes('이어폰')) return 'earphone';
  if (value.includes('안 틀') || value.includes('소리 없음')) return 'quiet';
  return 'unknown';
}

function inferSleepSoundPreference(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('작은 소리') || value.includes('괜찮')) return 'speakerOk';
  if (value.includes('안 틀') || value.includes('껐')) return 'noSpeaker';
  return 'unknown';
}

function inferSleepScreenTarget(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('음악')) return 'audio';
  if (value.includes('화면') || value.includes('봐요') || value.includes('영상')) {
    return value.includes('안 봐') ? 'noScreen' : 'screen';
  }
  if (value.includes('안 봐')) return 'noScreen';
  return 'unknown';
}

function inferSleepScreenPreference(value: string | undefined): SleepEnvironmentValueKind {
  if (!value) return 'unknown';
  if (value.includes('밝기 낮추')) return 'lowScreenOk';
  if (value.includes('상관') || value.includes('괜찮')) return 'screenOk';
  if (value.includes('안 켰') || value.includes('안 켜')) return 'noScreen';
  return 'unknown';
}
