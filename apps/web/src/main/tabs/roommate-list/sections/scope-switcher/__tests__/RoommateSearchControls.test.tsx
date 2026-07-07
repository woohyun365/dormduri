import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateSearchControls } from '../RoommateSearchControls';
import { mapRoommateSearchManifest } from '../../../model/filters/roommateSearchManifestModel';
import { createManifest } from '../../../model/search/__tests__/roommateSearchTestFixtures';

const actionableManifest = mapRoommateSearchManifest(
  createManifest({
    scope: 'SAME_BUILDING_ONLY',
    sorts: { default: 'MATCH_SCORE', options: ['NICKNAME', 'MATCH_SCORE'] },
  }),
);

describe('RoommateSearchControls', () => {
  it('scopeAvailability로 닫힌 scope button을 비활성화한다', async () => {
    const onScopeChange = vi.fn();
    render(
      <RoommateSearchControls
        scope="CAMPUS_MERGED"
        sort="NICKNAME"
        manifest={null}
        scopeAvailability={{ campusMerged: true, sameBuildingOnly: false }}
        disabled={false}
        onScopeChange={onScopeChange}
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '캠퍼스 전체' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '같은 건물' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '캠퍼스 전체' }));
    await userEvent.click(screen.getByRole('button', { name: '같은 건물' }));
    expect(onScopeChange).not.toHaveBeenCalled();
  });

  it('manifest sort option 중 inactive sort만 변경 요청을 보낸다', async () => {
    const onSortChange = vi.fn();
    render(
      <RoommateSearchControls
        scope="SAME_BUILDING_ONLY"
        sort="NICKNAME"
        manifest={actionableManifest}
        scopeAvailability={{ campusMerged: true, sameBuildingOnly: true }}
        disabled={false}
        onScopeChange={vi.fn()}
        onSortChange={onSortChange}
      />,
    );

    expect(screen.getByRole('button', { name: '닉네임순' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '같은 건물' })).toHaveClass('hover:bg-blue-900');
    await userEvent.click(screen.getByRole('button', { name: '닉네임순' }));
    await userEvent.click(screen.getByRole('button', { name: '매칭도순' }));

    expect(onSortChange).toHaveBeenCalledWith('MATCH_SCORE');
    expect(onSortChange).toHaveBeenCalledTimes(1);
  });

  it('manifest에서 filter가 닫혀도 scope/sort controls 안에 필터 진입 copy를 만들지 않는다', () => {
    const manifest = mapRoommateSearchManifest(
      createManifest({
        scope: 'CAMPUS_MERGED',
        purpose: 'BROAD_PREVIEW',
        filters: { enabled: false, fields: {} },
        sorts: { default: 'NICKNAME', options: ['NICKNAME'] },
      }),
    );

    render(
      <RoommateSearchControls
        scope="CAMPUS_MERGED"
        sort="NICKNAME"
        manifest={manifest}
        scopeAvailability={{ campusMerged: true, sameBuildingOnly: false }}
        disabled={false}
        onScopeChange={vi.fn()}
        onSortChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByText('현재 탐색 범위에서는 조건 필터를 사용할 수 없어요.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('조건 필터')).not.toBeInTheDocument();
  });
});
