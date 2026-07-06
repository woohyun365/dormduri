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

    expect(screen.getByRole('button', { name: '캠퍼스 전체' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '같은 건물' })).toBeDisabled();

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

    expect(screen.getByRole('button', { name: '닉네임순' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '적합도순' }));

    expect(onSortChange).toHaveBeenCalledWith('MATCH_SCORE');
  });

  it('manifest에서 filter가 닫히면 policy copy를 표시한다', () => {
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

    expect(screen.getByText('현재 시즌 정책상 상세 필터는 열리지 않아요.')).toBeInTheDocument();
  });
});
