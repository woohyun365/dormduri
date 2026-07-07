import { render, screen, within } from '@testing-library/react';
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

    const filterSection = screen.getByRole('region', { name: '룸메이트 조건 필터' });
    expect(within(filterSection).getByText('조건 필터')).toBeInTheDocument();
    expect(
      within(filterSection).queryByText('적용 중인 상세 필터가 없어요.'),
    ).not.toBeInTheDocument();

    const openButton = within(filterSection).getByRole('button', { name: '필터 열기' });
    expect(openButton).toHaveClass('rounded-xl', 'px-3', 'py-2', 'text-xs');
    expect(openButton).not.toHaveClass('rounded-2xl', 'px-4', 'py-3', 'text-sm');

    await userEvent.click(openButton);
    expect(onOpen).toHaveBeenCalledTimes(1);

    const activeChipGroup = within(filterSection).getByLabelText('적용 중인 필터');
    expect(activeChipGroup).toHaveClass('lg:flex-col', 'lg:items-stretch');

    const activeChip = screen.getByRole('button', { name: '흡연 여부 비흡연 필터 제거' });
    expect(activeChip).toHaveClass(
      'inline-flex',
      'justify-between',
      'px-2.5',
      'py-1.5',
      'text-[11px]',
      'lg:w-full',
    );
    const closeMarker = within(activeChip).getByText('×');
    expect(closeMarker).toHaveClass('shrink-0');
    await userEvent.click(activeChip);
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

    expect(screen.getByText('조건 필터')).toBeInTheDocument();
    expect(
      screen.getByText('현재 탐색 범위에서는 조건 필터를 사용할 수 없어요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('적용 중인 상세 필터가 없어요.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필터 열기' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '필터 열기' }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
