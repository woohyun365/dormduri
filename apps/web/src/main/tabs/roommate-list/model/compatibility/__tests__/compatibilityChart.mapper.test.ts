import { describe, expect, it } from 'vitest';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { mapCompatibilityToChartViewModel } from '../compatibilityChart.mapper';
import { findCompatibilityPrivacyViolations } from '../compatibilityPrivacy.policy';

describe('compatibilityChart.mapper', () => {
  it('PublicProfileCompatibility를 radar/list view model로 변환한다', () => {
    const compatibility = createPublicProfileFull().compatibility!;

    const viewModel = mapCompatibilityToChartViewModel(compatibility);

    expect(viewModel.overallScoreLabel).toBe('전체 적합도 92점');
    expect(viewModel.axes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'SMOKING', label: '흡연', scoreLabel: '100점' }),
        expect.objectContaining({ id: 'CLEAN_LEVEL', label: '청소', bucketLabel: '조율 가능' }),
      ]),
    );
    expect(viewModel.points).toHaveLength(compatibility.axes.length);
    expect(viewModel.polygonPoints).toContain(',');
    expect(viewModel.hiddenNotices[0]).toContain('민감 항목');
  });

  it('UNKNOWN 축은 center point와 정보 없음 copy를 사용한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 70,
      axes: [{ id: 'WAKE_TIME', score: null, bucket: 'UNKNOWN' }],
      hiddenAxisNotices: [],
    });

    expect(viewModel.axes[0]).toMatchObject({
      label: '기상 시간',
      scoreLabel: '점수 없음',
      bucketLabel: '정보 없음',
    });
    expect(viewModel.points[0]).toMatchObject({ x: 50, y: 50 });
  });

  it('view model JSON에는 hidden/raw key가 없다', () => {
    const viewModel = mapCompatibilityToChartViewModel(createPublicProfileFull().compatibility!);

    expect(findCompatibilityPrivacyViolations(JSON.stringify(viewModel))).toEqual([]);
  });
});
