import { Headphones, MonitorSmartphone, Moon, Volume2 } from 'lucide-react';
import {
  TwoLaneRangeCard,
  type TwoLaneOption,
  type TwoLaneSupportLevel,
} from '../primitives/TwoLaneRangeCard';
import type { CompatibilityAxis } from '../types';

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

type SleepEnvironmentSupportLevel = TwoLaneSupportLevel;

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

type SleepEnvironmentLaneOption = TwoLaneOption<SleepEnvironmentValueKind>;

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
      <TwoLaneRangeCard
        title="취침 시 화면 밝기"
        targetUsageLabel="상대의 화면 사용"
        rangeTone={screenChannel.axis?.bucketTone ?? 'unknown'}
        targetKind={screenChannel.targetKind}
        viewerLabel={getSleepEnvironmentScreenPreferenceLabel(screenChannel.viewerKind)}
        supportByKind={getSleepEnvironmentScreenSupportByKind(screenChannel.viewerKind)}
        options={SCREEN_USAGE_LANE_OPTIONS}
        note={
          screenChannel.targetKind === 'audio'
            ? { text: '음악만 듣는 경우는 화면 빛 없음으로 봐요.' }
            : null
        }
      />
      <TwoLaneRangeCard
        title="취침 시 스피커 사용"
        targetUsageLabel="상대의 스피커 사용"
        rangeTone={soundChannel.axis?.bucketTone ?? 'unknown'}
        targetKind={soundChannel.targetKind}
        viewerLabel={getSleepEnvironmentSoundPreferenceLabel(soundChannel.viewerKind)}
        supportByKind={getSleepEnvironmentSoundSupportByKind(soundChannel.viewerKind)}
        options={SLEEP_SOUND_LANE_OPTIONS}
        note={
          soundChannel.targetKind === 'earphone' ? { text: '이어폰 사용은 무음과 같아요.' } : null
        }
      />
    </div>
  );
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
