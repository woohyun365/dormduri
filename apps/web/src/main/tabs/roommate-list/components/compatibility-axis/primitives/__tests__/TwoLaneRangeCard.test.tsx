import { render, screen, within } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { TwoLaneRangeCard, type TwoLaneOption } from '../TwoLaneRangeCard';

type TestOptionId = 'allowed' | 'partial' | 'outside';

const options: readonly TwoLaneOption<TestOptionId>[] = [
  { id: 'allowed', label: '허용 범위 안', Icon: Circle },
  { id: 'partial', label: '조율 가능', Icon: Circle },
  { id: 'outside', label: '범위 밖', Icon: Circle },
];

describe('TwoLaneRangeCard', () => {
  it('나의 조건 범위와 active 상대 pill의 320px hide rule을 primitive에서 제공한다', () => {
    render(
      <TwoLaneRangeCard
        title="테스트 lane"
        targetUsageLabel="상대의 현재 상태"
        rangeTone="medium"
        targetKind="partial"
        viewerLabel="낮으면 OK"
        supportByKind={{ allowed: 'match', partial: 'partial' }}
        options={options}
        note={{ text: '도움말' }}
      />,
    );

    const lane = screen.getByLabelText('테스트 lane 2-lane');
    expect(within(lane).getByText('나의 조건 범위')).toBeInTheDocument();
    expect(within(lane).getByText('상대의 현재 상태')).toBeInTheDocument();
    expect(within(lane).getByText('범위 밖')).toBeInTheDocument();
    expect(within(lane).getByText('도움말')).toBeInTheDocument();

    const active = within(lane).getByText('조율 가능').closest('li');
    expect(active).toHaveAttribute('aria-current', 'true');

    const activePill = within(lane).getByText('상대');
    expect(activePill).toHaveClass('hidden', 'min-[361px]:inline-flex');
  });
});
