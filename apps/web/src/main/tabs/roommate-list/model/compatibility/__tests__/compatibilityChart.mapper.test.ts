import { describe, expect, it } from 'vitest';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { mapCompatibilityToChartViewModel } from '../compatibilityChart.mapper';
import { findCompatibilityPrivacyViolations } from '../compatibilityPrivacy.policy';

describe('compatibilityChart.mapper', () => {
  it('PublicProfileCompatibility를 radar/list view model로 변환한다', () => {
    const compatibility = createPublicProfileFull().compatibility!;

    const viewModel = mapCompatibilityToChartViewModel(compatibility);

    expect(viewModel.overallScore).toBe(92);
    expect(viewModel.overallScoreLabel).toBe('매칭점수 92점');
    expect(viewModel.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'SMOKING',
          label: '흡연',
          description: '상대 흡연 여부를 확인해요.',
          scoreLabel: '매칭도',
        }),
        expect.objectContaining({
          id: 'CLEAN_SPACE',
          label: '청소 루틴',
          bucketLabel: '조율 가능',
        }),
      ]),
    );
    expect(viewModel.axes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'SMOKING',
          label: '흡연',
          comparison: { targetText: '비흡연', viewerText: '비흡연자가 좋아요' },
        }),
        expect.objectContaining({
          id: 'CLEAN_LEVEL',
          label: '청소 습관',
          bucketLabel: '조율 가능',
        }),
      ]),
    );
    expect(viewModel.points).toHaveLength(compatibility.dimensions.length);
    expect(viewModel.points).toHaveLength(8);
    expect(viewModel.polygonPoints).toContain(',');
    expect(viewModel.outerPolygonPoints).toContain(',');
    expect(viewModel.gridPolygonPoints).toHaveLength(3);
    expect(viewModel.points[0]).toEqual(
      expect.objectContaining({ outerX: 50, outerY: 14, labelX: 50, labelY: 0 }),
    );
    expect(viewModel.hiddenNotices).toEqual([]);
  });

  it('유동 기상 축은 정보 없음 대신 중립 일정 copy를 사용한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 70,
      dimensions: [
        { id: 'SLEEP_RHYTHM', score: null, bucket: 'UNKNOWN', axisIds: ['BEDTIME', 'WAKE_TIME'] },
      ],
      axes: [
        {
          id: 'WAKE_TIME',
          score: null,
          bucket: 'UNKNOWN',
          comparison: { targetText: '수업에 따라 유동적', viewerText: '7~8시' },
        },
      ],
      hiddenAxisNotices: [],
    });

    expect(viewModel.dimensions[0]).toMatchObject({
      label: '수면 리듬',
      scoreLabel: '매칭도',
      bucketLabel: '정보 없음',
    });
    expect(viewModel.axes[0]).toMatchObject({
      label: '기상',
      scoreLabel: '점수 제외',
      bucketLabel: '유동적',
      neutralNotice: '수업 일정에 따라 달라요.',
    });
    expect(viewModel.points[0]).toMatchObject({ x: 50, y: 50 });
  });

  it('유동적 상태가 아닌 UNKNOWN 축은 정보 없음 copy를 유지한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 70,
      dimensions: [
        { id: 'SLEEP_RHYTHM', score: null, bucket: 'UNKNOWN', axisIds: ['BEDTIME', 'WAKE_TIME'] },
      ],
      axes: [
        {
          id: 'WAKE_TIME',
          score: null,
          bucket: 'UNKNOWN',
          comparison: { targetText: '미입력', viewerText: '7~8시' },
        },
      ],
      hiddenAxisNotices: [],
    });

    const wakeTimeAxis = viewModel.axes[0];
    expect(wakeTimeAxis).toBeDefined();
    if (!wakeTimeAxis) throw new Error('expected wake time axis');

    expect(wakeTimeAxis).toMatchObject({
      label: '기상',
      scoreLabel: '점수 없음',
      bucketLabel: '정보 없음',
    });
    expect(wakeTimeAxis.neutralNotice).toBeUndefined();
  });

  it('view model JSON에는 hidden/raw key가 없다', () => {
    const viewModel = mapCompatibilityToChartViewModel(createPublicProfileFull().compatibility!);

    expect(findCompatibilityPrivacyViolations(JSON.stringify(viewModel))).toEqual([]);
  });
});
