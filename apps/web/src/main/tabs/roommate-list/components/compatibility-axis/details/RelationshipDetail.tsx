import { Users } from 'lucide-react';
import type { CompatibilityAxis } from '../types';

type RelationshipDistanceKind = 'casual' | 'close' | 'unknown';

const RELATIONSHIP_DISTANCE_OPTIONS: readonly {
  readonly id: Exclude<RelationshipDistanceKind, 'unknown'>;
  readonly label: string;
  readonly labelClassName: string;
}[] = [
  {
    id: 'casual',
    label: '각자 생활해요',
    labelClassName: 'text-slate-700',
  },
  {
    id: 'close',
    label: '친하게 지내요',
    labelClassName: 'text-orange-700',
  },
];

export function RelationshipDistanceComparisonCard({
  axis,
}: {
  readonly axis: CompatibilityAxis | undefined;
}) {
  const targetKind = inferRelationshipDistance(axis?.comparison.targetText);
  const viewerKind = inferRelationshipDistance(axis?.comparison.viewerText);
  const targetLabel = getRelationshipDistanceLabel(targetKind);
  const viewerLabel = getRelationshipDistanceLabel(viewerKind);
  const markersOverlap = targetKind === viewerKind;
  const matchedKind = getMatchedRelationshipDistanceKind(viewerKind, targetKind);

  return (
    <div
      className="mt-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm"
      aria-label="기숙사 생활 방식 룸메와의 소통 비교"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-orange-50"
          aria-hidden="true"
        >
          <Users className="h-3.5 w-3.5 text-orange-600" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">룸메와의 소통</p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-(--knu-text-secondary)">
            원하는 룸메와의 친밀도를 비교해요.
          </p>
          <ul
            className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-extrabold leading-4"
            aria-label="룸메와의 소통 marker 색상 안내"
          >
            <li className="inline-flex items-center gap-1 text-indigo-700">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />나
            </li>
            <li className="inline-flex items-center gap-1 text-sky-700">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden="true" />
              상대
            </li>
          </ul>
        </div>
      </div>

      <div
        className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-4"
        aria-label="각자 생활해요 친하게 지내요 룸메와의 소통 막대"
      >
        <div className="relative px-2 pt-2">
          <div className="relative h-5 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div className="grid h-full grid-cols-2" aria-hidden="true">
              {RELATIONSHIP_DISTANCE_OPTIONS.map((option) => (
                <span
                  key={option.id}
                  className={getRelationshipDistanceSegmentClass(option.id, matchedKind)}
                />
              ))}
            </div>
            <RelationshipDistanceMarker
              kind={viewerKind}
              label="나"
              valueLabel={viewerLabel}
              className="bg-indigo-500"
              overlapSide={markersOverlap ? 'left' : 'center'}
            />
            <RelationshipDistanceMarker
              kind={targetKind}
              label="상대"
              valueLabel={targetLabel}
              className="bg-sky-500"
              overlapSide={markersOverlap ? 'right' : 'center'}
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1" aria-label="룸메와의 소통 단계">
          {RELATIONSHIP_DISTANCE_OPTIONS.map((option) => (
            <div
              key={option.id}
              className={`px-2 py-1 text-center text-[10px] font-extrabold leading-4 ${option.labelClassName}`}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RelationshipDistanceMarker({
  kind,
  label,
  valueLabel,
  className,
  overlapSide,
}: {
  readonly kind: RelationshipDistanceKind;
  readonly label: string;
  readonly valueLabel: string;
  readonly className: string;
  readonly overlapSide: 'left' | 'center' | 'right';
}) {
  return (
    <span
      className={`absolute top-1/2 h-4 w-4 rounded-full border-2 border-white shadow-md ${className}`}
      style={{
        left: getRelationshipDistanceLeft(kind),
        transform: getRelationshipDistanceMarkerTransform(overlapSide),
      }}
      aria-label={`${label}: ${valueLabel}`}
    >
      <span className="sr-only">{`${label}: ${valueLabel}`}</span>
    </span>
  );
}

function getRelationshipDistanceMarkerTransform(overlapSide: 'left' | 'center' | 'right') {
  if (overlapSide === 'left') return 'translate(-85%, -50%)';
  if (overlapSide === 'right') return 'translate(-15%, -50%)';
  return 'translate(-50%, -50%)';
}

function inferRelationshipDistance(value: string | undefined): RelationshipDistanceKind {
  if (!value) return 'unknown';
  if (value.includes('친')) return 'close';
  if (value.includes('각자') || value.includes('거리') || value.includes('생활')) return 'casual';
  return 'unknown';
}

function getRelationshipDistanceLeft(kind: RelationshipDistanceKind): string {
  if (kind === 'casual') return '25%';
  if (kind === 'close') return '75%';
  return '50%';
}

function getRelationshipDistanceLabel(kind: RelationshipDistanceKind): string {
  if (kind === 'casual') return '각자 생활해요';
  if (kind === 'close') return '친하게 지내요';
  return '확인 필요';
}

function getMatchedRelationshipDistanceKind(
  viewerKind: RelationshipDistanceKind,
  targetKind: RelationshipDistanceKind,
): Exclude<RelationshipDistanceKind, 'unknown'> | null {
  if (viewerKind === 'unknown' || targetKind === 'unknown') return null;
  return viewerKind === targetKind ? viewerKind : null;
}

function getRelationshipDistanceSegmentClass(
  optionId: Exclude<RelationshipDistanceKind, 'unknown'>,
  matchedKind: Exclude<RelationshipDistanceKind, 'unknown'> | null,
): string {
  const baseClass = 'bg-slate-100';
  if (optionId !== matchedKind) return baseClass;
  return 'bg-emerald-100';
}
