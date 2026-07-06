import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoommateFilterSheet } from '../RoommateFilterSheet';
import { mapRoommateSearchManifest } from '../../model/filters/roommateSearchManifestModel';
import {
  createCampusMergedManifest,
  createManifest,
} from '../../model/search/__tests__/roommateSearchTestFixtures';

const actionableManifest = mapRoommateSearchManifest(createManifest());

describe('RoommateFilterSheet', () => {
  it('BaseBottomSheet dialog 안에서 manifest field를 조작하고 compact payload를 apply한다', async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <RoommateFilterSheet
        isOpen
        manifest={actionableManifest}
        query={{ scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE', filters: {} }}
        onClose={onClose}
        onApply={onApply}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 필터' });
    await userEvent.click(within(dialog).getByRole('button', { name: '비흡연' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '제외' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '공과대학' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'E' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '80점 이상' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '필터 적용' }));

    expect(onApply).toHaveBeenCalledWith({
      smokingBehavior: 'NO',
      college: { operator: 'EXCLUDE', values: ['ENGINEERING'] },
      mbtiTraits: { energy: 'E' },
      minScore: 80,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('filter closed manifest에서는 정책 copy와 disabled apply를 보여준다', () => {
    render(
      <RoommateFilterSheet
        isOpen
        manifest={mapRoommateSearchManifest(createCampusMergedManifest())}
        query={{ scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: { smokingBehavior: 'NO' } }}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: '룸메이트 상세 필터' })).toBeInTheDocument();
    expect(screen.getByText('현재 시즌 정책상 상세 필터는 열리지 않아요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '필터 적용' })).toBeDisabled();
  });

  it('초기화는 draft만 비우고 적용 시 빈 payload를 전달한다', async () => {
    const onApply = vi.fn();
    render(
      <RoommateFilterSheet
        isOpen
        manifest={actionableManifest}
        query={{
          scope: 'SAME_BUILDING_ONLY',
          sort: 'MATCH_SCORE',
          filters: {
            smokingBehavior: 'NO',
            college: { operator: 'EXCLUDE', values: ['ENGINEERING'] },
          },
        }}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '룸메이트 상세 필터' });
    await userEvent.click(within(dialog).getByRole('button', { name: '초기화' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '필터 적용' }));

    expect(onApply).toHaveBeenCalledWith({});
  });

  it('Escape로 닫으면 이전 trigger focus를 복원한다', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            테스트 필터 열기
          </button>
          <RoommateFilterSheet
            isOpen={open}
            manifest={actionableManifest}
            query={{ scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE', filters: {} }}
            onClose={() => setOpen(false)}
            onApply={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole('button', { name: '테스트 필터 열기' });
    trigger.focus();
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: '룸메이트 상세 필터' })).toHaveFocus(),
    );

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: '룸메이트 상세 필터' })).not.toBeInTheDocument();
  });
});
