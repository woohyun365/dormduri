import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateSearchFilterBar } from '../RoommateSearchFilterBar';
import { mapRoommateSearchManifest } from '../../../model/filters/roommateSearchManifestModel';
import {
  createCampusMergedManifest,
  createManifest,
} from '../../../model/search/__tests__/roommateSearchTestFixtures';

const actionableManifest = mapRoommateSearchManifest(createManifest());

describe('RoommateSearchFilterBar', () => {
  it('filter가 열린 manifest에서는 sheet open CTA와 active chip removal을 렌더링한다', async () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const onReset = vi.fn();

    render(
      <RoommateSearchFilterBar
        manifest={actionableManifest}
        query={{
          scope: 'SAME_BUILDING_ONLY',
          sort: 'MATCH_SCORE',
          filters: { smokingBehavior: 'NO' },
        }}
        disabled={false}
        onOpenFilterSheet={onOpen}
        onRemoveFilter={onRemove}
        onResetFilters={onReset}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '필터 열기' }));
    expect(onOpen).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: '흡연 비흡연 필터 제거' }));
    expect(onRemove).toHaveBeenCalledWith('smokingBehavior');

    await userEvent.click(screen.getByRole('button', { name: '전체 해제' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('canOpenFilterSheet=false이면 open button을 비활성화하고 policy copy를 표시한다', async () => {
    const onOpen = vi.fn();
    render(
      <RoommateSearchFilterBar
        manifest={mapRoommateSearchManifest(createCampusMergedManifest())}
        query={{ scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: {} }}
        disabled={false}
        onOpenFilterSheet={onOpen}
        onRemoveFilter={vi.fn()}
        onResetFilters={vi.fn()}
      />,
    );

    expect(screen.getByText('현재 시즌 정책상 상세 필터는 열리지 않아요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필터 열기' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '필터 열기' }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
