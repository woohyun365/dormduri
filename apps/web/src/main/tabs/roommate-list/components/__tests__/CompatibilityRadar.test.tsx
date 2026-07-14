import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { mapCompatibilityToChartViewModel } from '../../model/compatibility/compatibilityChart.mapper';
import { CompatibilityRadar } from '../CompatibilityRadar';

describe('CompatibilityRadar', () => {
  it('repo-native SVG octagon radar와 전체 점수 label을 렌더링한다', () => {
    const viewModel = mapCompatibilityToChartViewModel(createPublicProfileFull().compatibility!);

    render(<CompatibilityRadar viewModel={viewModel} />);

    expect(screen.getByText('매칭점수 분석')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '축별 적합도 한눈에 보기' })).toBeInTheDocument();
    expect(screen.getByLabelText('매칭점수 92점')).toHaveClass('text-green-600', 'bg-green-100');
    expect(screen.getByText('92점')).toBeInTheDocument();
    expect(
      screen.queryByText('축별 생활패턴 차이를 점수와 그래프로 보여줘요.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('수면 리듬')).toHaveClass('text-[4.5px]');
    expect(screen.getByText('잠버릇')).toHaveClass('text-[4.5px]');
    expect(screen.getByText('수면 환경')).toBeInTheDocument();
    expect(screen.getByText('통화·미디어')).toBeInTheDocument();
    expect(screen.getByText('청소 루틴')).toBeInTheDocument();
    expect(screen.getByText('온도 조절')).toBeInTheDocument();
    expect(screen.getByText('친밀도')).toBeInTheDocument();

    const sleepHabitText = screen.getByText('잠버릇');
    const temperatureText = screen.getByText('온도 조절');
    const temperaturePoint = viewModel.points.find((point) => point.id === 'TEMPERATURE')!;
    expect(sleepHabitText).toBeInTheDocument();
    expect(Number(temperatureText.getAttribute('x'))).toBeLessThan(temperaturePoint.labelX);
    const polygons = document.querySelectorAll('polygon');
    expect(polygons[0]).toHaveAttribute('points', viewModel.outerPolygonPoints);
    expect(viewModel.points).toHaveLength(8);
    expect(viewModel.outerPolygonPoints.split(' ')).toHaveLength(8);
    expect(
      Array.from(polygons).some(
        (polygon) => polygon.getAttribute('points') === viewModel.polygonPoints,
      ),
    ).toBe(true);
    expect(screen.getAllByTestId('radar-score-point')).toHaveLength(viewModel.points.length);
    expect(document.querySelector('line')).toHaveAttribute(
      'x2',
      String(viewModel.points[0]?.outerX),
    );
    expect(screen.getByText('정확한 축별 값은 축별 적합도 목록에서 확인할 수 있어요.')).toHaveClass(
      'sr-only',
    );
  });
});
