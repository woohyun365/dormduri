import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { mapCompatibilityToChartViewModel } from '../../model/compatibility/compatibilityChart.mapper';
import { findCompatibilityPrivacyViolations } from '../../model/compatibility/compatibilityPrivacy.policy';
import { CompatibilityAxisList } from '../CompatibilityAxisList';

describe('CompatibilityAxisList', () => {
  it('Octagon 축별 score bar와 각 축의 구성 항목 details를 제공한다', () => {
    const viewModel = mapCompatibilityToChartViewModel(createPublicProfileFull().compatibility!);

    render(<CompatibilityAxisList viewModel={viewModel} />);

    expect(screen.getByRole('heading', { name: '축별 적합도' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: '축별 적합도 목록' });
    expect(viewModel.dimensions).toHaveLength(8);
    expect(within(list).getAllByText('흡연').length).toBeGreaterThan(0);
    expect(within(list).getByText('수면 리듬')).toBeInTheDocument();
    expect(within(list).getAllByText('잠버릇').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('수면 환경').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('통화·미디어').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('청소 루틴').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('온도 조절').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('친밀도').length).toBeGreaterThan(0);
    expect(within(list).getByText('상대 흡연 여부를 확인해요.')).toBeInTheDocument();
    expect(within(list).getByText('청소 빈도·실내 취식을 조율해요.')).toHaveClass(
      'break-keep',
      'whitespace-normal',
    );
    expect(within(list).getAllByText('매칭도').length).toBeGreaterThan(0);
    expect(within(list).queryByText('100점')).not.toBeInTheDocument();

    expect(screen.getByText('흡연 자세히 보기')).toBeInTheDocument();
    expect(screen.getByText('수면 리듬 자세히 보기')).toBeInTheDocument();
    expect(screen.getByText('잠버릇 자세히 보기')).toBeInTheDocument();
    expect(screen.getByText('수면 환경 자세히 보기')).toBeInTheDocument();
    expect(screen.getByText('통화·미디어 자세히 보기')).toHaveClass(
      'break-keep',
      'whitespace-normal',
    );
    expect(screen.getByText('청소 루틴 자세히 보기')).toBeInTheDocument();
    expect(screen.getByText('온도 조절 자세히 보기')).toBeInTheDocument();
    expect(screen.getByText('친밀도 자세히 보기')).toBeInTheDocument();
    const relationshipDetails = screen.getByRole('list', {
      name: '기숙사 생활 방식 점수 구성 항목',
    });
    expect(within(relationshipDetails).getByText('기숙사 생활 방식')).toBeInTheDocument();

    const smokingDetails = screen.getByRole('list', { name: '흡연 점수 구성 항목' });
    const smokingSummaryCard = smokingDetails.parentElement;
    const smokingDimensionItem = smokingSummaryCard?.parentElement;
    const matchingBar = smokingDimensionItem?.querySelector(':scope > div[aria-hidden="true"]');
    const smokingDimensionChildren = Array.from(smokingDimensionItem?.children ?? []);
    expect(smokingSummaryCard).not.toBeNull();
    expect(matchingBar).not.toBeNull();
    expect(smokingDimensionChildren.indexOf(smokingSummaryCard!)).toBeLessThan(
      smokingDimensionChildren.indexOf(matchingBar!),
    );
    expect(smokingDetails).toHaveClass('sm:grid-cols-1');
    expect(within(smokingDetails).getByText('흡연')).toHaveClass('break-keep');
    expect(within(smokingDetails).getByText('상대방')).toBeInTheDocument();
    expect(within(smokingDetails).getByText('나의 선호')).toBeInTheDocument();
    const smokingDisclosure = screen.getByText('흡연 자세히 보기').closest('details');
    expect(smokingDisclosure).not.toBeNull();
    expect(smokingDisclosure?.querySelector('[aria-label="흡연 점수 구성 항목"]')).toBeNull();
    expect(smokingDisclosure?.querySelector('[aria-label="흡연 기준 비교"]')).not.toBeNull();
    expect(screen.getByLabelText('흡연 기준 비교')).toBeInTheDocument();
    expect(
      screen.getByLabelText('나의 흡연 허용 기준과 상대 흡연 여부 조합표'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('비흡연만').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('흡연 체감 단계')).toHaveClass('grid-cols-2');
    expect(screen.getAllByText('수용 가능').length).toBeGreaterThan(0);
    expect(screen.getAllByText('조율 필수').length).toBeGreaterThan(0);
    expect(within(smokingDetails).queryByText('영향 큼')).not.toBeInTheDocument();
    expect(within(smokingDetails).queryByText('100점')).not.toBeInTheDocument();
    expect(screen.queryByText(/일부 민감 항목은 정책상/)).not.toBeInTheDocument();
    expect(findCompatibilityPrivacyViolations(document.body.textContent ?? '')).toEqual([]);
  });

  it('수면 리듬 details는 취침/기상 시간대 비교를 제공한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 88,
      dimensions: [
        { id: 'SLEEP_RHYTHM', score: 88, bucket: 'HIGH', axisIds: ['BEDTIME', 'WAKE_TIME'] },
      ],
      axes: [
        {
          id: 'BEDTIME',
          score: 86,
          bucket: 'HIGH',
          comparison: {
            targetText: '22~24시 사이에 잠들어요',
            viewerText: '22~24시 사이에 잠드는 사람이 편해요',
          },
        },
        {
          id: 'WAKE_TIME',
          score: null,
          bucket: 'UNKNOWN',
          comparison: {
            targetText: '수업에 따라 유동적',
            viewerText: '수업에 따라 유동적',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    expect(screen.getByText('수면 리듬 자세히 보기')).toBeInTheDocument();
    const sleepRhythmDetails = screen.getByRole('list', { name: '수면 리듬 점수 구성 항목' });
    expect(within(sleepRhythmDetails).getByText('취침')).toBeInTheDocument();
    expect(within(sleepRhythmDetails).getByText('기상')).toBeInTheDocument();
    expect(within(sleepRhythmDetails).getByText('유동적')).toBeInTheDocument();
    expect(within(sleepRhythmDetails).getByText('수업 일정에 따라 달라요.')).toBeInTheDocument();
    const timeSlotComparison = screen.getByLabelText('수면 리듬 시간대 비교');
    expect(within(timeSlotComparison).getByText('취침 시간 / 기상 시간')).toBeInTheDocument();
    expect(within(timeSlotComparison).getByLabelText('취침 시간대 시각화')).toBeInTheDocument();
    expect(within(timeSlotComparison).getByLabelText('기상 시간대 시각화')).toBeInTheDocument();
    expect(within(timeSlotComparison).getByText('22~24시')).toBeInTheDocument();
    expect(within(timeSlotComparison).getByText('상대 · 유동 일정')).toBeInTheDocument();
    expect(within(timeSlotComparison).getByText('나 · 유동 일정')).toBeInTheDocument();
    const wakeTimeTimeline = within(timeSlotComparison).getByLabelText('기상 시간대 시각화');
    expect(wakeTimeTimeline.outerHTML).toContain('border-indigo-300');
    expect(wakeTimeTimeline.outerHTML).toContain('border-sky-300');
    const bedtimeTimeline = within(timeSlotComparison).getByLabelText('취침 시간대 시각화');
    expect(bedtimeTimeline.outerHTML).toContain('border-indigo-300');
    expect(bedtimeTimeline.outerHTML).toContain('ring-sky-200');
    expect(bedtimeTimeline.outerHTML).toContain('flex-col');
    expect(bedtimeTimeline.outerHTML).toContain('min-[360px]:flex-row');
    expect(within(sleepRhythmDetails).queryByText('영향 낮음')).not.toBeInTheDocument();
  });

  it('잠버릇과 수면 환경 details를 분리하고 잠버릇 체감 UI를 제공한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 72,
      dimensions: [
        {
          id: 'SLEEP_HABIT',
          score: 20,
          bucket: 'LOW',
          axisIds: ['SLEEP_HABIT'],
        },
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 54,
          bucket: 'MEDIUM',
          axisIds: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
        },
      ],
      axes: [
        {
          id: 'SLEEP_HABIT',
          score: 20,
          bucket: 'LOW',
          comparison: {
            targetText: '코골이',
            viewerText: '잠귀가 보통인 편이에요',
          },
        },
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 66,
          bucket: 'MEDIUM',
          comparison: {
            targetText: '스피커로 작게 틀어요',
            viewerText: '잘 때 작은 스피커 소리는 괜찮아요',
          },
        },
        {
          id: 'SCREEN_USAGE',
          score: 42,
          bucket: 'LOW',
          comparison: {
            targetText: '잠들 때 화면을 켜는 편이에요',
            viewerText: '잘 때 화면을 봐도 괜찮아요',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    expect(screen.getByText('잠버릇 자세히 보기')).toBeInTheDocument();
    const sleepHabitDetails = screen.getByRole('list', { name: '잠버릇 점수 구성 항목' });
    expect(sleepHabitDetails).toHaveClass('sm:grid-cols-1');
    expect(within(sleepHabitDetails).getByText('잠버릇')).toBeInTheDocument();
    expect(within(sleepHabitDetails).getByText('상대방')).toBeInTheDocument();
    expect(within(sleepHabitDetails).getByText('나의 잠귀')).toBeInTheDocument();
    const sleepHabitImpactCard = screen.getByLabelText('잠버릇 예상 체감');
    expect(within(sleepHabitImpactCard).getByText('잠버릇 예상 체감')).toBeInTheDocument();
    expect(within(sleepHabitImpactCard).getByText('나의 잠귀에 따라 달라요.')).toBeInTheDocument();
    expect(within(sleepHabitImpactCard).getByLabelText('나의 잠귀: 보통')).toBeInTheDocument();
    expect(
      within(sleepHabitImpactCard).getAllByLabelText('현재 조합: 보통 민감도와 코골이').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(sleepHabitImpactCard).getAllByText('잠버릇: 코골이·이갈이·잠꼬대 기준').length,
    ).toBeGreaterThanOrEqual(1);
    expect(within(sleepHabitImpactCard).getByLabelText('현재 조합 체감 막대')).toBeInTheDocument();
    expect(
      within(sleepHabitImpactCard).getAllByText((_, element) =>
        Boolean(
          element?.textContent?.includes('잠버릇의 심한 정도는 구분하지 않아요.') &&
          element.textContent.includes('대화로 확인해보세요.'),
        ),
      ).length,
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('수면 환경 자세히 보기')).toBeInTheDocument();
    const roomEnvironmentDetails = screen.getByRole('list', {
      name: '수면 환경 점수 구성 항목',
    });
    expect(roomEnvironmentDetails).toHaveClass('sm:grid-cols-2');
    expect(within(roomEnvironmentDetails).getByText('취침 시 화면 밝기')).toBeInTheDocument();
    expect(within(roomEnvironmentDetails).getByText('취침 시 스피커 사용')).toBeInTheDocument();
    expect(within(roomEnvironmentDetails).queryByText('잠버릇')).not.toBeInTheDocument();
    const sleepEnvironmentCoordination = screen.getByLabelText('취침 전 수면 환경 조율 정보');
    expect(
      within(sleepEnvironmentCoordination).getByText('상대방의 기기 사용 방식'),
    ).toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('취침 전 조율 포인트'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText(
        '취침 시 화면 밝기와 스피커 사용을 따로 맞춰봐요.',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByLabelText('상대방 취침 전 기기 사용 방식'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByLabelText('Threshold Rail / 허용선 UI'),
    ).not.toBeInTheDocument();
    const sleepDeviceComparison = within(sleepEnvironmentCoordination).getByLabelText(
      '상대방 기기 사용 비교',
    );
    expect(
      within(sleepDeviceComparison).getByLabelText('상대방 기기 사용 2-lane'),
    ).toBeInTheDocument();
    expect(
      within(sleepDeviceComparison).getByLabelText('취침 시 화면 밝기 2-lane'),
    ).toBeInTheDocument();
    expect(
      within(sleepDeviceComparison).getByLabelText('취침 시 스피커 사용 2-lane'),
    ).toBeInTheDocument();
    expect(
      within(sleepDeviceComparison).queryByLabelText('나의 기준과 비교'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepDeviceComparison).getByLabelText('취침 시 화면 밝기 나의 조건 범위'),
    ).toHaveClass('border-slate-300');
    expect(
      within(sleepDeviceComparison).getByLabelText('취침 시 스피커 사용 나의 조건 범위'),
    ).toHaveClass('border-blue-200');
    expect(
      within(sleepEnvironmentCoordination).queryByText('취침 시 화면·스피커 허용선'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).getByText('잘 때 화면·스피커 사용을 확인해요.'),
    ).toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText(
        '화면 밝기와 스피커 사용을 한 번에 비교해요.',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('화면 잘 맞음'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('소리 잘 맞음'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('상대방 화면을 봐요'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('나의 조건 화면 OK'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('상대방 스피커로 작게'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('나의 조건 작은 소리 OK'),
    ).not.toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('상대의 화면 사용')).toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).getByText('상대의 스피커 사용'),
    ).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('화면 OK')).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('작은 소리 OK')).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getAllByText('상대').length).toBeGreaterThanOrEqual(
      2,
    );
    const activeScreenOption = within(sleepDeviceComparison).getByText('화면을 봐요').closest('li');
    expect(activeScreenOption).toHaveClass(
      'border-sky-300',
      'bg-sky-50/90',
      'text-sky-900',
      'ring-1',
      'ring-sky-200',
    );
    expect(within(activeScreenOption!).getByText('상대')).toHaveClass(
      'hidden',
      'min-[361px]:inline-flex',
    );
    expect(
      within(sleepEnvironmentCoordination).queryByLabelText('Inclusion Zone / 포함 영역 UI'),
    ).not.toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('안 봐요')).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('음악만 들어요')).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('화면을 봐요')).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('무음')).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('이어폰 사용')).toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).getByText('스피커로 작게')).toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByLabelText('밝기와 소리 조합 SVG'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText('상대방의 화면·소리 조합'),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByLabelText('취침 전 편안함 Bar'),
    ).not.toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).queryByText('편안함 Bar')).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText(
        '화면 빛과 스피커 소리를 함께 본 체감 요약이에요.',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByText(
        '이어폰·무음은 소리 없음, 음악만 듣는 경우는 화면 빛 없음으로 봐요.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('수면 리듬 시간대 비교')).not.toBeInTheDocument();
  });

  it('수면 환경 details는 2-lane 안에서 나의 조건 범위와 예외 안내를 표시한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 96,
      dimensions: [
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 100,
          bucket: 'HIGH',
          axisIds: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
        },
      ],
      axes: [
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 100,
          bucket: 'HIGH',
          comparison: {
            targetText: '이어폰 사용',
            viewerText: '잘 때 작은 스피커 소리는 괜찮아요',
          },
        },
        {
          id: 'SCREEN_USAGE',
          score: 100,
          bucket: 'HIGH',
          comparison: {
            targetText: '음악만 들어요',
            viewerText: '잘 때 화면은 안 켰으면 좋겠어요',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const sleepEnvironmentCoordination = screen.getByLabelText('취침 전 수면 환경 조율 정보');
    expect(
      within(sleepEnvironmentCoordination).getByText('상대방의 기기 사용 방식'),
    ).toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).getAllByText('음악만 들어요').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(sleepEnvironmentCoordination).getAllByText('이어폰 사용').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(sleepEnvironmentCoordination).getByText('음악만 듣는 경우는 화면 빛 없음으로 봐요.'),
    ).toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).getByText('이어폰 사용은 무음과 같아요.'),
    ).toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).getByLabelText('취침 시 화면 밝기 나의 조건 범위'),
    ).toHaveClass('border-emerald-200');
    expect(
      within(sleepEnvironmentCoordination).getByLabelText('취침 시 스피커 사용 나의 조건 범위'),
    ).toHaveClass('border-emerald-200');
    expect(
      within(sleepEnvironmentCoordination).queryByText('나의 기준과 비교'),
    ).not.toBeInTheDocument();
    expect(within(sleepEnvironmentCoordination).queryByText('편안함 Bar')).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByLabelText(/취침 시 화면 밝기 기준 비교/),
    ).not.toBeInTheDocument();
    expect(
      within(sleepEnvironmentCoordination).queryByLabelText(/취침 시 스피커 사용 기준 비교/),
    ).not.toBeInTheDocument();
  });

  it('청소 루틴 details는 청소 빈도/실내 취식 기준을 2-lane으로 제공한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 70,
      dimensions: [
        {
          id: 'CLEAN_SPACE',
          score: 40,
          bucket: 'LOW',
          axisIds: ['CLEAN_LEVEL', 'INDOOR_EATING'],
        },
      ],
      axes: [
        {
          id: 'CLEAN_LEVEL',
          score: 30,
          bucket: 'LOW',
          comparison: {
            targetText: '몰아서 정리하는 편이에요',
            viewerText: '눈에 띄면 정리하면 괜찮아요',
          },
        },
        {
          id: 'INDOOR_EATING',
          score: 50,
          bucket: 'MEDIUM',
          comparison: {
            targetText: '배달·간편식도 먹어요',
            viewerText: '환기·정리 잘하면 OK',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const cleanSpaceCoordination = screen.getByLabelText('청소 루틴 조율 정보');
    expect(within(cleanSpaceCoordination).getByText('상대의 청소·취식 습관')).toBeInTheDocument();
    expect(
      within(cleanSpaceCoordination).getByText('청소 빈도·실내 취식 습관을 조율해요.'),
    ).toBeInTheDocument();
    expect(
      within(cleanSpaceCoordination).getByLabelText('상대방 청소 루틴 2-lane'),
    ).toBeInTheDocument();

    const cleanLane = within(cleanSpaceCoordination).getByLabelText('청소 빈도 2-lane');
    expect(within(cleanLane).getByText('눈에 띄면 OK')).toBeInTheDocument();
    const cleanRange = within(cleanLane).getByLabelText('청소 빈도 나의 조건 범위');
    expect(cleanRange).toHaveClass('border-slate-300');
    expect(within(cleanRange).getByText('상대의 청소 루틴')).toBeInTheDocument();
    expect(within(cleanRange).getByText('눈에 띄면 정리')).toBeInTheDocument();
    expect(within(cleanRange).queryByText('몰아서 정리')).not.toBeInTheDocument();
    const activeCleanCell = within(cleanLane).getByText('몰아서 정리').closest('li');
    expect(activeCleanCell).toHaveClass('border-sky-300', 'text-sky-900', 'ring-1', 'ring-sky-200');
    expect(activeCleanCell).toHaveClass('min-w-0', 'items-start');
    expect(within(activeCleanCell!).getByText('몰아서 정리')).toHaveClass(
      'flex-1',
      'break-keep',
      'whitespace-normal',
    );
    expect(within(activeCleanCell!).getByText('상대')).toHaveClass(
      'hidden',
      'min-[361px]:inline-flex',
    );

    const eatingLane = within(cleanSpaceCoordination).getByLabelText('실내 취식 2-lane');
    expect(within(eatingLane).getByText('환기·정리하면 OK')).toBeInTheDocument();
    const eatingRange = within(eatingLane).getByLabelText('실내 취식 나의 조건 범위');
    expect(eatingRange).toHaveClass('border-blue-200');
    expect(within(eatingRange).getByText('상대의 실내 취식 습관')).toBeInTheDocument();
    expect(within(eatingRange).getByText('배달·간편식')).toBeInTheDocument();
    const activeEatingCell = within(eatingRange).getByText('배달·간편식').closest('li');
    expect(activeEatingCell).toHaveClass(
      'border-sky-300',
      'text-sky-900',
      'ring-1',
      'ring-sky-200',
    );
    expect(within(activeEatingCell!).getByText('상대')).toHaveClass(
      'hidden',
      'min-[361px]:inline-flex',
    );
    expect(within(eatingLane).getByText('실내 취식은 냄새가 기준이에요.')).toBeInTheDocument();
  });

  it('온도 조절 details는 추위-보통-더위 bar에서 나와 상대 위치를 보여준다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 72,
      dimensions: [
        {
          id: 'TEMPERATURE',
          score: 50,
          bucket: 'MEDIUM',
          axisIds: ['TEMPERATURE'],
        },
      ],
      axes: [
        {
          id: 'TEMPERATURE',
          score: 50,
          bucket: 'MEDIUM',
          comparison: {
            targetText: '더위 타요',
            viewerText: '보통',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const temperatureComparison = screen.getByLabelText('온도 조절 비교');
    expect(within(temperatureComparison).getByText('에어컨·난방 민감도')).toBeInTheDocument();
    expect(
      within(temperatureComparison).getByText('추위·더위 민감도를 한 줄로 비교해요.'),
    ).toBeInTheDocument();
    const temperatureLegend =
      within(temperatureComparison).getByLabelText('온도 조절 marker 색상 안내');
    expect(within(temperatureLegend).getByText('나')).toBeInTheDocument();
    expect(within(temperatureLegend).getByText('상대')).toBeInTheDocument();
    expect(
      within(temperatureComparison).getByLabelText('추위 보통 더위 온도 조절 막대'),
    ).toBeInTheDocument();
    expect(within(temperatureComparison).getByLabelText('나: 보통')).toBeInTheDocument();
    expect(within(temperatureComparison).getByLabelText('상대: 더위 탐')).toBeInTheDocument();
    expect(within(temperatureComparison).getByText('추위 탐')).toBeInTheDocument();
    expect(within(temperatureComparison).getByText('보통')).toBeInTheDocument();
    expect(within(temperatureComparison).getByText('더위 탐')).toBeInTheDocument();
  });

  it('친밀도 details는 룸메와의 소통 rail에서 나와 상대 위치를 보여준다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 72,
      dimensions: [
        {
          id: 'RELATIONSHIP_STYLE',
          score: 0,
          bucket: 'LOW',
          axisIds: ['RELATIONSHIP'],
        },
      ],
      axes: [
        {
          id: 'RELATIONSHIP',
          score: 0,
          bucket: 'LOW',
          comparison: {
            targetText: '친하게 지내요',
            viewerText: '각자 생활해요',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const relationshipComparison = screen.getByLabelText('기숙사 생활 방식 룸메와의 소통 비교');
    expect(within(relationshipComparison).getByText('룸메와의 소통')).toBeInTheDocument();
    expect(
      within(relationshipComparison).getByText('원하는 룸메와의 친밀도를 비교해요.'),
    ).toBeInTheDocument();
    const relationshipLegend =
      within(relationshipComparison).getByLabelText('룸메와의 소통 marker 색상 안내');
    expect(within(relationshipLegend).getByText('나')).toBeInTheDocument();
    expect(within(relationshipLegend).getByText('상대')).toBeInTheDocument();
    const relationshipTrack = within(relationshipComparison).getByLabelText(
      '각자 생활해요 친하게 지내요 룸메와의 소통 막대',
    );
    expect(relationshipTrack).toBeInTheDocument();
    expect(relationshipTrack.outerHTML).not.toContain('bg-linear-to-r');
    expect(relationshipTrack.outerHTML).toContain('bg-slate-100');
    expect(relationshipTrack.outerHTML).not.toContain('border-slate-300');
    expect(relationshipTrack.outerHTML).not.toContain('bg-orange-200');
    expect(relationshipTrack.outerHTML).not.toContain('bg-gray-100');
    expect(relationshipTrack.outerHTML).not.toContain('ring-emerald-300');
    expect(relationshipTrack.outerHTML).not.toContain('bg-emerald-100');
    expect(within(relationshipComparison).getByLabelText('나: 각자 생활해요')).toBeInTheDocument();
    expect(
      within(relationshipComparison).getByLabelText('상대: 친하게 지내요'),
    ).toBeInTheDocument();
    const relationshipSteps = within(relationshipComparison).getByLabelText('룸메와의 소통 단계');
    expect(within(relationshipSteps).getByText('각자 생활해요')).toHaveClass('text-slate-700');
    expect(within(relationshipSteps).getByText('각자 생활해요')).not.toHaveClass('bg-slate-100');
    expect(within(relationshipSteps).getByText('각자 생활해요')).not.toHaveClass(
      'border-slate-200',
    );
    expect(within(relationshipSteps).getByText('친하게 지내요')).toHaveClass('text-orange-700');
    expect(within(relationshipSteps).getByText('친하게 지내요')).not.toHaveClass('bg-orange-50');
    expect(within(relationshipSteps).getByText('친하게 지내요')).not.toHaveClass(
      'border-orange-100',
    );
    expect(
      within(relationshipComparison).queryByText('원하는 거리감이 비슷해요.'),
    ).not.toBeInTheDocument();
    expect(
      within(relationshipComparison).queryByText('원하는 거리감이 달라 대화로 맞춰보면 좋아요.'),
    ).not.toBeInTheDocument();
  });

  it('친밀도 details는 나와 상대 생활 방식이 같을 때만 green fill을 표시한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 96,
      dimensions: [
        {
          id: 'RELATIONSHIP_STYLE',
          score: 100,
          bucket: 'HIGH',
          axisIds: ['RELATIONSHIP'],
        },
      ],
      axes: [
        {
          id: 'RELATIONSHIP',
          score: 100,
          bucket: 'HIGH',
          comparison: {
            targetText: '각자 생활해요',
            viewerText: '각자 생활해요',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const relationshipComparison = screen.getByLabelText('기숙사 생활 방식 룸메와의 소통 비교');
    const relationshipTrack = within(relationshipComparison).getByLabelText(
      '각자 생활해요 친하게 지내요 룸메와의 소통 막대',
    );
    expect(relationshipTrack.outerHTML).toContain('bg-slate-100');
    expect(relationshipTrack.outerHTML).not.toContain('border-slate-300');
    expect(relationshipTrack.outerHTML).not.toContain('ring-emerald-300');
    expect(relationshipTrack.outerHTML).toContain('bg-emerald-100');
  });

  it('통화·미디어 details는 실내 통화/영상 시청 소리 기준을 2-lane으로 제공한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 64,
      dimensions: [
        {
          id: 'DEVICE_USAGE',
          score: 50,
          bucket: 'MEDIUM',
          axisIds: ['PHONE', 'EARPHONE'],
        },
      ],
      axes: [
        {
          id: 'PHONE',
          score: 30,
          bucket: 'LOW',
          comparison: {
            targetText: '자주 해요',
            viewerText: '가끔·짧게는 괜찮아요',
          },
        },
        {
          id: 'EARPHONE',
          score: 30,
          bucket: 'LOW',
          comparison: {
            targetText: '항상 스피커',
            viewerText: '작게 틀면 괜찮아요',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const deviceUsageCoordination = screen.getByLabelText('통화·미디어 사용 조율 정보');
    expect(
      within(deviceUsageCoordination).getByText('상대의 통화·이어폰 사용 습관'),
    ).toBeInTheDocument();
    expect(
      within(deviceUsageCoordination).getByText('실내 통화와 소리 습관을 확인해요.'),
    ).toBeInTheDocument();
    expect(
      within(deviceUsageCoordination).getByLabelText('상대방 통화·미디어 사용 2-lane'),
    ).toBeInTheDocument();

    const phoneLane = within(deviceUsageCoordination).getByLabelText('실내 통화 2-lane');
    expect(within(phoneLane).getByText('짧게는 OK')).toBeInTheDocument();
    const phoneRange = within(phoneLane).getByLabelText('실내 통화 나의 조건 범위');
    expect(phoneRange).toHaveClass('border-slate-300');
    expect(within(phoneRange).getByText('상대의 실내 통화 습관')).toBeInTheDocument();
    expect(within(phoneRange).getByText('가끔 해요')).toBeInTheDocument();
    expect(within(phoneRange).queryByText('자주 해요')).not.toBeInTheDocument();
    const activePhoneCell = within(phoneLane).getByText('자주 해요').closest('li');
    expect(activePhoneCell).toHaveClass('border-sky-300', 'text-sky-900', 'ring-1', 'ring-sky-200');
    expect(activePhoneCell).toHaveClass('min-w-0', 'items-start');
    expect(within(activePhoneCell!).getByText('자주 해요')).toHaveClass(
      'flex-1',
      'break-keep',
      'whitespace-normal',
    );
    expect(within(activePhoneCell!).getByText('상대')).toHaveClass(
      'hidden',
      'min-[361px]:inline-flex',
    );

    const earphoneLane = within(deviceUsageCoordination).getByLabelText('영상 시청 시 소리 2-lane');
    expect(within(earphoneLane).getByText('작은 소리 OK')).toBeInTheDocument();
    const earphoneRange = within(earphoneLane).getByLabelText('영상 시청 시 소리 나의 조건 범위');
    expect(earphoneRange).toHaveClass('border-slate-300');
    expect(within(earphoneRange).getByText('상대의 이어폰 습관')).toBeInTheDocument();
    expect(within(earphoneRange).getByText('주로 스피커')).toBeInTheDocument();
    expect(within(earphoneRange).queryByText('항상 스피커')).not.toBeInTheDocument();
    const activeEarphoneCell = within(earphoneLane).getByText('항상 스피커').closest('li');
    expect(activeEarphoneCell).toHaveClass(
      'border-sky-300',
      'text-sky-900',
      'ring-1',
      'ring-sky-200',
    );
    expect(within(activeEarphoneCell!).getByText('항상 스피커')).toHaveClass(
      'flex-1',
      'break-keep',
      'whitespace-normal',
    );
    expect(within(activeEarphoneCell!).getByText('상대')).toHaveClass(
      'hidden',
      'min-[361px]:inline-flex',
    );
  });

  it('screenTolerance LOW_OK는 화면 사용을 부분 조율 범위로 표시한다', () => {
    const viewModel = mapCompatibilityToChartViewModel({
      overallScore: 76,
      dimensions: [
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 75,
          bucket: 'HIGH',
          axisIds: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
        },
      ],
      axes: [
        {
          id: 'SLEEP_ENVIRONMENT',
          score: 100,
          bucket: 'HIGH',
          comparison: {
            targetText: '안 틀어요',
            viewerText: '잘 때 스피커는 껐으면 좋겠어요',
          },
        },
        {
          id: 'SCREEN_USAGE',
          score: 50,
          bucket: 'MEDIUM',
          comparison: {
            targetText: '화면을 봐요',
            viewerText: '밝기 낮추면 괜찮아요',
          },
        },
      ],
      hiddenAxisNotices: [],
    });

    render(<CompatibilityAxisList viewModel={viewModel} />);

    const sleepEnvironmentCoordination = screen.getByLabelText('취침 전 수면 환경 조율 정보');
    expect(within(sleepEnvironmentCoordination).getByText('밝기 낮추면 OK')).toBeInTheDocument();
    const screenRange = within(sleepEnvironmentCoordination).getByLabelText(
      '취침 시 화면 밝기 나의 조건 범위',
    );
    expect(screenRange).toHaveClass('border-blue-200');
    expect(within(screenRange).getByText('화면을 봐요')).toBeInTheDocument();
    const activeScreenCell = within(screenRange).getByText('화면을 봐요').closest('li');
    expect(activeScreenCell).toHaveClass(
      'border-sky-300',
      'text-sky-900',
      'ring-1',
      'ring-sky-200',
    );
    expect(activeScreenCell).toHaveClass('min-w-0', 'items-start');
    expect(within(activeScreenCell!).getByText('화면을 봐요')).toHaveClass(
      'flex-1',
      'break-keep',
      'whitespace-normal',
    );
    expect(within(activeScreenCell!).getByText('상대')).toHaveClass(
      'hidden',
      'min-[361px]:inline-flex',
    );
    expect(screenRange.outerHTML).not.toContain('border-violet-200');
    expect(screenRange.outerHTML).not.toContain('text-violet-800');
    expect(document.body.innerHTML).not.toContain('amber-');
  });
});
