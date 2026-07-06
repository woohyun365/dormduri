import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { mapCompatibilityToChartViewModel } from '../../model/compatibility/compatibilityChart.mapper';
import { CompatibilityRadar } from '../CompatibilityRadar';

describe('CompatibilityRadar', () => {
  it('repo-native SVG radar와 전체 점수 label을 렌더링한다', () => {
    const viewModel = mapCompatibilityToChartViewModel(createPublicProfileFull().compatibility!);

    render(<CompatibilityRadar viewModel={viewModel} />);

    expect(screen.getByRole('heading', { name: '적합도 한눈에 보기' })).toBeInTheDocument();
    expect(screen.getByText('전체 적합도 92점')).toBeInTheDocument();
    expect(document.querySelector('polygon')).toHaveAttribute('points', viewModel.polygonPoints);
    expect(screen.getByText('정확한 축별 값은 축별 적합도 목록에서 확인할 수 있어요.')).toHaveClass(
      'sr-only',
    );
  });
});
