import type {
  PublicProfileCompatibility,
  PublicProfileCompatibilityAxis,
  PublicProfileCompatibilityAxisId,
} from '@repo/shared/profile/contract';
import {
  COMPATIBILITY_PRIVACY_NOTE,
  compatibilityAxisLabel,
  compatibilityBucketLabel,
  compatibilityBucketTone,
  compatibilityHiddenNoticeLabel,
  compatibilityOverallScoreLabel,
  compatibilityScoreLabel,
  type CompatibilityBucketTone,
} from './compatibilityCopy';
import { assertCompatibilityPrivacySafe } from './compatibilityPrivacy.policy';

export interface CompatibilityAxisViewModel {
  readonly id: PublicProfileCompatibilityAxisId;
  readonly label: string;
  readonly scoreLabel: string;
  readonly bucketLabel: string;
  readonly bucketTone: CompatibilityBucketTone;
  readonly score: number | null;
}

export interface CompatibilityRadarPoint {
  readonly id: PublicProfileCompatibilityAxisId;
  readonly x: number;
  readonly y: number;
  readonly labelX: number;
  readonly labelY: number;
}

export interface CompatibilityChartViewModel {
  readonly overallScoreLabel: string;
  readonly axes: readonly CompatibilityAxisViewModel[];
  readonly points: readonly CompatibilityRadarPoint[];
  readonly polygonPoints: string;
  readonly hiddenNotices: readonly string[];
  readonly privacyNote: string;
}

const RADAR_CENTER = 50;
const RADAR_RADIUS = 36;
const RADAR_LABEL_RADIUS = 45;

export function mapCompatibilityToChartViewModel(
  compatibility: PublicProfileCompatibility,
): CompatibilityChartViewModel {
  const axes = compatibility.axes.map(mapCompatibilityAxis);
  const points = compatibility.axes.map((axis, index) =>
    mapCompatibilityAxisPoint(axis, index, compatibility.axes.length),
  );
  const hiddenNotices = compatibility.hiddenAxisNotices.map((notice) =>
    compatibilityHiddenNoticeLabel(notice.code),
  );
  const viewModel = {
    overallScoreLabel: compatibilityOverallScoreLabel(compatibility.overallScore),
    axes,
    points,
    polygonPoints: points.map((point) => `${point.x},${point.y}`).join(' '),
    hiddenNotices,
    privacyNote: COMPATIBILITY_PRIVACY_NOTE,
  } satisfies CompatibilityChartViewModel;

  assertCompatibilityPrivacySafe(JSON.stringify(viewModel));
  return viewModel;
}

function mapCompatibilityAxis(axis: PublicProfileCompatibilityAxis): CompatibilityAxisViewModel {
  return {
    id: axis.id,
    label: compatibilityAxisLabel(axis.id),
    scoreLabel: compatibilityScoreLabel(axis.score),
    bucketLabel: compatibilityBucketLabel(axis.bucket),
    bucketTone: compatibilityBucketTone(axis.bucket),
    score: axis.score,
  };
}

function mapCompatibilityAxisPoint(
  axis: PublicProfileCompatibilityAxis,
  index: number,
  total: number,
): CompatibilityRadarPoint {
  const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
  const normalizedScore = typeof axis.score === 'number' ? axis.score / 100 : 0;
  const radius = RADAR_RADIUS * normalizedScore;
  const x = roundRadarCoordinate(RADAR_CENTER + Math.cos(angle) * radius);
  const y = roundRadarCoordinate(RADAR_CENTER + Math.sin(angle) * radius);
  const labelX = roundRadarCoordinate(RADAR_CENTER + Math.cos(angle) * RADAR_LABEL_RADIUS);
  const labelY = roundRadarCoordinate(RADAR_CENTER + Math.sin(angle) * RADAR_LABEL_RADIUS);
  return { id: axis.id, x, y, labelX, labelY };
}

function roundRadarCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
