import type {
  PublicProfileCompatibility,
  PublicProfileCompatibilityAxis,
  PublicProfileCompatibilityAxisId,
  PublicProfileCompatibilityDimension,
  PublicProfileCompatibilityDimensionId,
} from '@repo/shared/profile/contract';
import {
  COMPATIBILITY_PRIVACY_NOTE,
  compatibilityAxisDescription,
  compatibilityAxisLabel,
  compatibilityBucketLabel,
  compatibilityBucketTone,
  compatibilityDimensionDescription,
  compatibilityDimensionLabel,
  compatibilityOverallScoreLabel,
  compatibilityScoreLabel,
  type CompatibilityBucketTone,
} from './compatibilityCopy';
import { assertCompatibilityPrivacySafe } from './compatibilityPrivacy.policy';

export interface CompatibilityAxisViewModel {
  readonly id: PublicProfileCompatibilityAxisId;
  readonly label: string;
  readonly description: string;
  readonly scoreLabel: string;
  readonly bucketLabel: string;
  readonly bucketTone: CompatibilityBucketTone;
  readonly score: number | null;
  readonly neutralNotice?: string;
  readonly comparison: {
    readonly targetText: string;
    readonly viewerText: string;
  };
}

export interface CompatibilityDimensionViewModel {
  readonly id: PublicProfileCompatibilityDimensionId;
  readonly label: string;
  readonly description: string;
  readonly scoreLabel: string;
  readonly bucketLabel: string;
  readonly bucketTone: CompatibilityBucketTone;
  readonly score: number | null;
  readonly axisIds: readonly PublicProfileCompatibilityAxisId[];
}

export interface CompatibilityRadarPoint {
  readonly id: PublicProfileCompatibilityDimensionId;
  readonly x: number;
  readonly y: number;
  readonly outerX: number;
  readonly outerY: number;
  readonly labelX: number;
  readonly labelY: number;
}

export interface CompatibilityChartViewModel {
  readonly overallScore: number;
  readonly overallScoreLabel: string;
  readonly dimensions: readonly CompatibilityDimensionViewModel[];
  readonly axes: readonly CompatibilityAxisViewModel[];
  readonly points: readonly CompatibilityRadarPoint[];
  readonly polygonPoints: string;
  readonly outerPolygonPoints: string;
  readonly gridPolygonPoints: readonly string[];
  readonly hiddenNotices: readonly string[];
  readonly privacyNote: string;
}

const RADAR_CENTER = 50;
const RADAR_RADIUS = 36;
const RADAR_LABEL_RADIUS = 50;
const RADAR_GRID_RATIOS = [1 / 3, 2 / 3, 1] as const;

export function mapCompatibilityToChartViewModel(
  compatibility: PublicProfileCompatibility,
): CompatibilityChartViewModel {
  const axes = compatibility.axes.map(mapCompatibilityAxis);
  const dimensions = compatibility.dimensions.map(mapCompatibilityDimension);
  const points = compatibility.dimensions.map((dimension, index) =>
    mapCompatibilityDimensionPoint(dimension, index, compatibility.dimensions.length),
  );
  const viewModel = {
    overallScore: compatibility.overallScore,
    overallScoreLabel: compatibilityOverallScoreLabel(compatibility.overallScore),
    dimensions,
    axes,
    points,
    polygonPoints: points.map((point) => `${point.x},${point.y}`).join(' '),
    outerPolygonPoints: points.map((point) => `${point.outerX},${point.outerY}`).join(' '),
    gridPolygonPoints: RADAR_GRID_RATIOS.map((ratio) =>
      mapRadarGridPolygonPoints(compatibility.dimensions.length, ratio),
    ),
    hiddenNotices: [],
    privacyNote: COMPATIBILITY_PRIVACY_NOTE,
  } satisfies CompatibilityChartViewModel;

  assertCompatibilityPrivacySafe(JSON.stringify(viewModel));
  return viewModel;
}

function mapCompatibilityDimension(
  dimension: PublicProfileCompatibilityDimension,
): CompatibilityDimensionViewModel {
  return {
    id: dimension.id,
    label: compatibilityDimensionLabel(dimension.id),
    description: compatibilityDimensionDescription(dimension.id),
    scoreLabel: '매칭도',
    bucketLabel: compatibilityBucketLabel(dimension.bucket),
    bucketTone: compatibilityBucketTone(dimension.bucket),
    score: dimension.score,
    axisIds: dimension.axisIds,
  };
}

const WAKE_TIME_FLEXIBLE_COPY = '수업에 따라 유동적';
const WAKE_TIME_NEUTRAL_BUCKET_LABEL = '유동적';
const WAKE_TIME_NEUTRAL_SCORE_LABEL = '점수 제외';
const WAKE_TIME_NEUTRAL_NOTICE = '수업 일정에 따라 달라요.';

function mapCompatibilityAxis(axis: PublicProfileCompatibilityAxis): CompatibilityAxisViewModel {
  const neutralWakeTime = isNeutralWakeTimeAxis(axis);

  return {
    id: axis.id,
    label: compatibilityAxisLabel(axis.id),
    description: compatibilityAxisDescription(axis.id),
    scoreLabel: neutralWakeTime
      ? WAKE_TIME_NEUTRAL_SCORE_LABEL
      : compatibilityScoreLabel(axis.score),
    bucketLabel: neutralWakeTime
      ? WAKE_TIME_NEUTRAL_BUCKET_LABEL
      : compatibilityBucketLabel(axis.bucket),
    bucketTone: compatibilityBucketTone(axis.bucket),
    score: axis.score,
    comparison: axis.comparison,
    ...(neutralWakeTime ? { neutralNotice: WAKE_TIME_NEUTRAL_NOTICE } : {}),
  };
}

function isNeutralWakeTimeAxis(axis: PublicProfileCompatibilityAxis): boolean {
  return (
    axis.id === 'WAKE_TIME' &&
    axis.score === null &&
    (axis.comparison.targetText === WAKE_TIME_FLEXIBLE_COPY ||
      axis.comparison.viewerText === WAKE_TIME_FLEXIBLE_COPY)
  );
}

function mapCompatibilityDimensionPoint(
  dimension: PublicProfileCompatibilityDimension,
  index: number,
  total: number,
): CompatibilityRadarPoint {
  const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
  const normalizedScore = typeof dimension.score === 'number' ? dimension.score / 100 : 0;
  const radius = RADAR_RADIUS * normalizedScore;
  const x = roundRadarCoordinate(RADAR_CENTER + Math.cos(angle) * radius);
  const y = roundRadarCoordinate(RADAR_CENTER + Math.sin(angle) * radius);
  const outerX = roundRadarCoordinate(RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS);
  const outerY = roundRadarCoordinate(RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS);
  const labelX = roundRadarCoordinate(RADAR_CENTER + Math.cos(angle) * RADAR_LABEL_RADIUS);
  const labelY = roundRadarCoordinate(RADAR_CENTER + Math.sin(angle) * RADAR_LABEL_RADIUS);
  return { id: dimension.id, x, y, outerX, outerY, labelX, labelY };
}

function mapRadarGridPolygonPoints(total: number, ratio: number): string {
  return Array.from({ length: total }, (_, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
    const radius = RADAR_RADIUS * ratio;
    const x = roundRadarCoordinate(RADAR_CENTER + Math.cos(angle) * radius);
    const y = roundRadarCoordinate(RADAR_CENTER + Math.sin(angle) * radius);
    return `${x},${y}`;
  }).join(' ');
}

function roundRadarCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
