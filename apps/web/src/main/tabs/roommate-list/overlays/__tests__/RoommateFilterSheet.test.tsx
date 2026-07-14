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

    const dialog = screen.getByRole('dialog', { name: '상대 생활패턴·프로필 필터' });
    expect(within(dialog).getByText('원하는 상대의 흡연 여부')).toBeInTheDocument();
    expect(within(dialog).getByText('원하는 상대의 잠귀 밝음 정도')).toBeInTheDocument();
    expect(within(dialog).queryByText(/같은 건물 후보만 볼 수 있어요/)).not.toBeInTheDocument();
    expect(within(dialog).getByText('잠버릇 없음')).toBeInTheDocument();
    expect(within(dialog).getByText('잠버릇 있어도 상관없음')).toBeInTheDocument();
    expect(within(dialog).queryByText('잠꼬대')).not.toBeInTheDocument();
    const ageBandHelper = within(dialog).getByText(/한국식 나이/);
    expect(ageBandHelper).toBeInTheDocument();
    expect(ageBandHelper.parentElement).toHaveClass('mt-0', 'space-y-0');
    await userEvent.click(within(dialog).getByRole('button', { name: '비흡연' }));
    const excludeCollegeButton = within(dialog).getByRole('button', {
      name: '선택한 값 빼고 보기',
    });
    await userEvent.click(excludeCollegeButton);
    expect(excludeCollegeButton).toHaveClass('bg-(--knu-primary)', 'text-white');
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

    expect(screen.getByRole('dialog', { name: '상대 생활패턴·프로필 필터' })).toBeInTheDocument();
    expect(
      screen.getByText('현재 탐색 범위에서는 조건 필터를 사용할 수 없어요.'),
    ).toBeInTheDocument();
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

    const dialog = screen.getByRole('dialog', { name: '상대 생활패턴·프로필 필터' });
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
      expect(screen.getByRole('dialog', { name: '상대 생활패턴·프로필 필터' })).toHaveFocus(),
    );

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(
      screen.queryByRole('dialog', { name: '상대 생활패턴·프로필 필터' }),
    ).not.toBeInTheDocument();
  });
});
