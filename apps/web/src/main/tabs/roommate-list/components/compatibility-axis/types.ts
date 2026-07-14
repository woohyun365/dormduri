import type { ElementType } from 'react';
import type { CompatibilityChartViewModel } from '../../model/compatibility/compatibilityChart.mapper';

export interface CompatibilityAxisListProps {
  readonly viewModel: CompatibilityChartViewModel;
}

export type CompatibilityDimension = CompatibilityChartViewModel['dimensions'][number];
export type CompatibilityAxis = CompatibilityChartViewModel['axes'][number];
export type CompatibilityBucketTone = CompatibilityDimension['bucketTone'];

export interface CompactDetailTheme {
  readonly container: string;
  readonly list: string;
  readonly empty: string;
  readonly title: string;
}

export interface AxisVisualConfig {
  readonly Icon: ElementType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly iconClassName: string;
  readonly iconWrapperClassName: string;
}
