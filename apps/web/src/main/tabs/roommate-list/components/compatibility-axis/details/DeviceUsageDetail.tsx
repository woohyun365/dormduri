import { Headphones, Phone, PhoneCall, PhoneOff, Volume2 } from 'lucide-react';
import type { ElementType } from 'react';
import { RANGE_FRAME_CLASS, RANGE_TEXT_CLASS } from '../axisTone';
import type { CompatibilityAxis, CompatibilityBucketTone } from '../types';

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

type DeviceUsageSupportLevel = 'match' | 'partial' | 'outside';

interface DeviceUsageCoordinationChannel {
  readonly id: 'phone' | 'earphone';
  readonly axis: CompatibilityAxis | undefined;
  readonly targetKind: DeviceUsageValueKind;
  readonly viewerKind: DeviceUsageValueKind;
}

interface DeviceUsageLaneOption {
  readonly id: DeviceUsageValueKind;
  readonly label: string;
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
}

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
        <DeviceUsageLaneCard
          title="실내 통화"
          targetUsageLabel="상대의 실내 통화 습관"
          rangeTone={channels[0].axis?.bucketTone ?? 'unknown'}
          targetKind={channels[0].targetKind}
          viewerLabel={getPhonePreferenceLabel(channels[0].viewerKind)}
          supportByKind={getPhoneSupportByKind(channels[0].viewerKind)}
          options={PHONE_USAGE_LANE_OPTIONS}
        />
        <DeviceUsageLaneCard
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

function DeviceUsageLaneCard({
  title,
  targetUsageLabel,
  rangeTone,
  targetKind,
  viewerLabel,
  supportByKind: supportConfig,
  options,
}: {
  readonly title: string;
  readonly targetUsageLabel: string;
  readonly rangeTone: CompatibilityBucketTone;
  readonly targetKind: DeviceUsageValueKind;
  readonly viewerLabel: string;
  readonly supportByKind: Partial<Record<DeviceUsageValueKind, DeviceUsageSupportLevel>>;
  readonly options: readonly DeviceUsageLaneOption[];
}) {
  const supportByKind = Object.fromEntries(
    options.map((option) => [option.id, supportConfig[option.id] ?? 'outside']),
  ) as Record<DeviceUsageValueKind, DeviceUsageSupportLevel>;
  const acceptedOptions = options.filter((option) => supportByKind[option.id] !== 'outside');
  const outsideOptions = options.filter((option) => supportByKind[option.id] === 'outside');

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
                  <DeviceUsageLaneOptionItem
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
            <DeviceUsageLaneOptionItem
              key={option.id}
              option={option}
              active={option.id === targetKind}
              supportLevel={supportByKind[option.id]}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function DeviceUsageLaneOptionItem({
  option,
  active,
  supportLevel,
}: {
  readonly option: DeviceUsageLaneOption;
  readonly active: boolean;
  readonly supportLevel: DeviceUsageSupportLevel;
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
