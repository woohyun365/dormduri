import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { mapCompatibilityToChartViewModel } from '../../model/compatibility/compatibilityChart.mapper';
import { findCompatibilityPrivacyViolations } from '../../model/compatibility/compatibilityPrivacy.policy';
import { CompatibilityAxisList } from '../CompatibilityAxisList';

describe('CompatibilityAxisList', () => {
  it('screen-reader readable 축별 text fallback을 제공한다', () => {
    const viewModel = mapCompatibilityToChartViewModel(createPublicProfileFull().compatibility!);

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const list = screen.getByRole('list', { name: '축별 적합도 목록' });
    expect(within(list).getByText('흡연')).toBeInTheDocument();
    expect(within(list).getByText('100점')).toBeInTheDocument();
    expect(within(list).getByText('잘 맞음')).toBeInTheDocument();
    expect(within(list).getByText('청소')).toBeInTheDocument();
    expect(screen.getByText(/일부 민감 항목은 정책상/)).toBeInTheDocument();
    expect(findCompatibilityPrivacyViolations(document.body.textContent ?? '')).toEqual([]);
  });
});
