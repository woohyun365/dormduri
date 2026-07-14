import {
  Cigarette,
  MonitorSmartphone,
  Moon,
  Sparkles,
  Thermometer,
  Users,
  Volume2,
} from 'lucide-react';
import { IconEar } from '@tabler/icons-react';
import type { ElementType } from 'react';
import { getMatchScoreColor } from '@/utils/matchScoreColor';
import type { CompatibilityChartViewModel } from '../model/compatibility/compatibilityChart.mapper';
import type { PublicProfileCompatibilityDimensionId } from '@repo/shared/profile/contract';

interface CompatibilityRadarProps {
  readonly viewModel: CompatibilityChartViewModel;
}

const TEMPERATURE_LABEL_REFERENCE_LENGTH = '온도 조절'.length;

const RADAR_AXIS_ICON_CONFIG: Record<
  PublicProfileCompatibilityDimensionId,
  {
    readonly Icon: ElementType<{
      x?: number;
      y?: number;
      width?: string;
      height?: string;
      strokeWidth?: string | number;
      className?: string;
      'aria-hidden'?: boolean;
    }>;
    readonly className: string;
  }
> = {
  SMOKING: { Icon: Cigarette, className: 'text-rose-500' },
  SLEEP_RHYTHM: { Icon: Moon, className: 'text-amber-500' },
  SLEEP_HABIT: { Icon: IconEar, className: 'text-indigo-500' },
  SLEEP_ENVIRONMENT: { Icon: MonitorSmartphone, className: 'text-sky-500' },
  DEVICE_USAGE: { Icon: Volume2, className: 'text-blue-500' },
  CLEAN_SPACE: { Icon: Sparkles, className: 'text-emerald-500' },
  TEMPERATURE: { Icon: Thermometer, className: 'text-red-500' },
  RELATIONSHIP_STYLE: { Icon: Users, className: 'text-orange-500' },
};

export function CompatibilityRadar({ viewModel }: CompatibilityRadarProps) {
  const dimensionsById = new Map(
    viewModel.dimensions.map((dimension) => [dimension.id, dimension]),
  );

  return (
    <section
      aria-labelledby="roommate-compatibility-radar-heading"
      className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-indigo-700">매칭점수 분석</p>
          <h3
            id="roommate-compatibility-radar-heading"
            className="mt-1 text-sm font-bold text-(--knu-text-primary)"
          >
            축별 적합도 한눈에 보기
          </h3>
        </div>
        <div
          className={`flex shrink-0 flex-col items-end rounded-2xl px-3 py-1.5 text-right shadow-sm ${getMatchScoreColor(
            viewModel.overallScore,
          )}`}
          aria-label={viewModel.overallScoreLabel}
        >
          <span className="text-[10px] font-bold leading-none">매칭점수</span>
          <span className="mt-0.5 text-lg font-black leading-none tracking-tight">
            {viewModel.overallScore}점
          </span>
        </div>
      </div>

      <svg
        viewBox="-10 -8 120 116"
        className="mt-4 h-72 w-full overflow-visible"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <polygon
          points={viewModel.outerPolygonPoints}
          fill="rgb(255 255 255 / 0.65)"
          stroke="rgb(224 231 255)"
          strokeWidth="0.8"
        />
        {viewModel.gridPolygonPoints.map((points, index) => (
          <polygon
            key={points}
            points={points}
            fill={
              index === viewModel.gridPolygonPoints.length - 1 ? 'none' : 'rgb(99 102 241 / 0.025)'
            }
            stroke="rgb(224 231 255)"
            strokeWidth="0.7"
          />
        ))}
        {viewModel.points.map((point) => (
          <line
            key={point.id}
            x1="50"
            y1="50"
            x2={point.outerX}
            y2={point.outerY}
            stroke="currentColor"
            className="text-indigo-100"
            strokeWidth="0.8"
          />
        ))}
        <polygon
          points={viewModel.polygonPoints}
          fill="rgb(79 70 229 / 0.18)"
          stroke="rgb(79 70 229)"
          strokeWidth="1.8"
        />
        {viewModel.points.map((point) => (
          <circle
            key={`${point.id}-point`}
            data-testid="radar-score-point"
            cx={point.x}
            cy={point.y}
            r="1.8"
            fill="rgb(79 70 229)"
          />
        ))}
        {viewModel.points.map((point) => {
          const dimension = dimensionsById.get(point.id);
          if (!dimension) return null;
          const { Icon, className } = RADAR_AXIS_ICON_CONFIG[dimension.id];
          const { iconX, iconY, textX, textY } = getRadarLabelLayout(
            dimension.label,
            point,
            dimension.id,
          );

          return (
            <g key={`${point.id}-label`}>
              <Icon
                x={iconX}
                y={iconY}
                width="4.5"
                height="4.5"
                strokeWidth="2.6"
                className={className}
                aria-hidden={true}
              />
              <text
                x={textX}
                y={textY}
                textAnchor="start"
                dominantBaseline="middle"
                className="fill-slate-600 text-[4.5px] font-bold md:text-[4.7px] lg:text-[5px]"
              >
                {dimension.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="sr-only">정확한 축별 값은 축별 적합도 목록에서 확인할 수 있어요.</p>
    </section>
  );
}

function getRadarLabelLayout(
  label: string,
  point: CompatibilityChartViewModel['points'][number],
  dimensionId: PublicProfileCompatibilityDimensionId,
): {
  readonly iconX: number;
  readonly iconY: number;
  readonly textX: number;
  readonly textY: number;
} {
  const labelLength =
    dimensionId === 'TEMPERATURE' ? TEMPERATURE_LABEL_REFERENCE_LENGTH : label.length;
  const groupWidth = Math.max(12, Math.min(25, labelLength * 2.7 + 5.5));
  const groupX = point.labelX - groupWidth / 2 - 3.2;

  return {
    iconX: roundSvgCoordinate(groupX),
    iconY: roundSvgCoordinate(point.labelY - 2.2),
    textX: roundSvgCoordinate(groupX + 5.4),
    textY: roundSvgCoordinate(point.labelY + 1.15),
  };
}

function roundSvgCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
