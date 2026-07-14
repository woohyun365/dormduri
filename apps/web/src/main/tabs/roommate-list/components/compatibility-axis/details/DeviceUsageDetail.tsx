import { Headphones, Phone, PhoneCall, PhoneOff, Volume2 } from 'lucide-react';
import {
  TwoLaneRangeCard,
  type TwoLaneOption,
  type TwoLaneSupportLevel,
} from '../primitives/TwoLaneRangeCard';
import type { CompatibilityAxis } from '../types';

type DeviceUsageValueKind =
  | 'rarelyCall'
  | 'sometimesCall'
  | 'oftenCall'
  | 'outsideCallOnly'
  | 'briefCallOk'
  | 'anyCall'
  | 'alwaysEarphone'
  | 'mostlyEarphone'
  | 'mostlySpeaker'
  | 'alwaysSpeaker'
  | 'mustEarphone'
  | 'lowVolumeOk'
  | 'anySound'
  | 'unknown';

type DeviceUsageSupportLevel = TwoLaneSupportLevel;

interface DeviceUsageCoordinationChannel {
  readonly id: 'phone' | 'earphone';
  readonly axis: CompatibilityAxis | undefined;
  readonly targetKind: DeviceUsageValueKind;
  readonly viewerKind: DeviceUsageValueKind;
}

type DeviceUsageLaneOption = TwoLaneOption<DeviceUsageValueKind>;

const PHONE_USAGE_LANE_OPTIONS: readonly DeviceUsageLaneOption[] = [
  { id: 'rarelyCall', label: '잘 안 해요', Icon: PhoneOff },
  { id: 'sometimesCall', label: '가끔 해요', Icon: Phone },
  { id: 'oftenCall', label: '자주 해요', Icon: PhoneCall },
];

const EARPHONE_USAGE_LANE_OPTIONS: readonly DeviceUsageLaneOption[] = [
  { id: 'alwaysEarphone', label: '항상 이어폰', Icon: Headphones },
  { id: 'mostlyEarphone', label: '주로 이어폰', Icon: Headphones },
  { id: 'mostlySpeaker', label: '주로 스피커', Icon: Volume2 },
  { id: 'alwaysSpeaker', label: '항상 스피커', Icon: Volume2 },
];

export function DeviceUsageCoordinationCard({
  axes,
}: {
  readonly axes: readonly CompatibilityAxis[];
}) {
  const phoneAxis = axes.find((axis) => axis.id === 'PHONE');
  const earphoneAxis = axes.find((axis) => axis.id === 'EARPHONE');
  const channels = [
    {
      id: 'phone',
      axis: phoneAxis,
      targetKind: inferPhoneTarget(phoneAxis?.comparison.targetText),
      viewerKind: inferPhonePreference(phoneAxis?.comparison.viewerText),
    },
    {
      id: 'earphone',
      axis: earphoneAxis,
      targetKind: inferEarphoneTarget(earphoneAxis?.comparison.targetText),
      viewerKind: inferEarphonePreference(earphoneAxis?.comparison.viewerText),
    },
  ] as const satisfies readonly [DeviceUsageCoordinationChannel, DeviceUsageCoordinationChannel];

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="통화·미디어 사용 조율 정보"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-50"
          aria-hidden="true"
        >
          <Headphones className="h-3.5 w-3.5 text-sky-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">상대의 통화·이어폰 사용 습관</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            실내 통화와 소리 습관을 확인해요.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="상대방 통화·미디어 사용 2-lane">
        <TwoLaneRangeCard
          title="실내 통화"
          targetUsageLabel="상대의 실내 통화 습관"
          rangeTone={channels[0].axis?.bucketTone ?? 'unknown'}
          targetKind={channels[0].targetKind}
          viewerLabel={getPhonePreferenceLabel(channels[0].viewerKind)}
          supportByKind={getPhoneSupportByKind(channels[0].viewerKind)}
          options={PHONE_USAGE_LANE_OPTIONS}
        />
        <TwoLaneRangeCard
          title="영상 시청 시 소리"
          targetUsageLabel="상대의 이어폰 습관"
          rangeTone={channels[1].axis?.bucketTone ?? 'unknown'}
          targetKind={channels[1].targetKind}
          viewerLabel={getEarphonePreferenceLabel(channels[1].viewerKind)}
          supportByKind={getEarphoneSupportByKind(channels[1].viewerKind)}
          options={EARPHONE_USAGE_LANE_OPTIONS}
        />
      </div>
    </div>
  );
}

function getPhoneSupportByKind(
  kind: DeviceUsageValueKind,
): Partial<Record<DeviceUsageValueKind, DeviceUsageSupportLevel>> {
  if (kind === 'anyCall') {
    return { rarelyCall: 'match', sometimesCall: 'match', oftenCall: 'partial' };
  }
  if (kind === 'briefCallOk') {
    return { rarelyCall: 'match', sometimesCall: 'match' };
  }
  if (kind === 'outsideCallOnly') {
    return { rarelyCall: 'match' };
  }
  return {};
}

function getEarphoneSupportByKind(
  kind: DeviceUsageValueKind,
): Partial<Record<DeviceUsageValueKind, DeviceUsageSupportLevel>> {
  if (kind === 'anySound') {
    return {
      alwaysEarphone: 'match',
      mostlyEarphone: 'match',
      mostlySpeaker: 'match',
      alwaysSpeaker: 'match',
    };
  }
  if (kind === 'lowVolumeOk') {
    return {
      alwaysEarphone: 'match',
      mostlyEarphone: 'match',
      mostlySpeaker: 'partial',
    };
  }
  if (kind === 'mustEarphone') {
    return { alwaysEarphone: 'match', mostlyEarphone: 'partial' };
  }
  return {};
}

function getPhonePreferenceLabel(kind: DeviceUsageValueKind): string {
  if (kind === 'anyCall') return '상관없음';
  if (kind === 'briefCallOk') return '짧게는 OK';
  if (kind === 'outsideCallOnly') return '통화는 밖에서';
  return '통화 기준 확인 필요';
}

function getEarphonePreferenceLabel(kind: DeviceUsageValueKind): string {
  if (kind === 'anySound') return '상관없음';
  if (kind === 'lowVolumeOk') return '작은 소리 OK';
  if (kind === 'mustEarphone') return '소리는 이어폰으로';
  return '이어폰 기준 확인 필요';
}

function inferPhoneTarget(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('자주')) return 'oftenCall';
  if (value.includes('가끔')) return 'sometimesCall';
  if (value.includes('잘 안') || value.includes('거의')) return 'rarelyCall';
  return 'unknown';
}

function inferPhonePreference(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('상관')) return 'anyCall';
  if (value.includes('가끔') || value.includes('짧게')) return 'briefCallOk';
  if (value.includes('안 했') || value.includes('밖')) return 'outsideCallOnly';
  return 'unknown';
}

function inferEarphoneTarget(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('항상 스피커')) return 'alwaysSpeaker';
  if (value.includes('주로 스피커')) return 'mostlySpeaker';
  if (value.includes('주로 이어폰')) return 'mostlyEarphone';
  if (value.includes('항상 이어폰')) return 'alwaysEarphone';
  return 'unknown';
}

function inferEarphonePreference(value: string | undefined): DeviceUsageValueKind {
  if (!value) return 'unknown';
  if (value.includes('상관')) return 'anySound';
  if (value.includes('작게') || value.includes('작은 소리')) return 'lowVolumeOk';
  if (
    value.includes('이어폰으로') ||
    value.includes('들어줬') ||
    value.includes('꼭') ||
    value.includes('써줬')
  ) {
    return 'mustEarphone';
  }
  return 'unknown';
}
