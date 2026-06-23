import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingFaqSkeleton } from '../skeletons/LandingFaqSkeleton';

const readComponentSource = () =>
  readFileSync(
    path.join(process.cwd(), 'src', 'landing', 'components', 'skeletons', 'LandingFaqSkeleton.tsx'),
    'utf8',
  );

describe('LandingFaqSkeleton', () => {
  it('FAQ loading 상태를 scoped status로 노출하고 skeleton row는 장식으로 숨긴다', () => {
    render(<LandingFaqSkeleton itemCount={3} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('자주 묻는 질문을 불러오는 중이에요');
    expect(screen.getAllByTestId('landing-faq-skeleton-row')).toHaveLength(3);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    const decorativeGroup = status.querySelector('[aria-hidden="true"]');
    expect(decorativeGroup).toBeInTheDocument();
    expect(decorativeGroup).toContainElement(screen.getAllByTestId('landing-faq-skeleton-row')[0]!);
  });

  it('0 이하 itemCount도 최소 1개 row로 보정한다', () => {
    render(<LandingFaqSkeleton itemCount={0} label="FAQ 로딩 중" />);

    expect(screen.getByRole('status')).toHaveTextContent('FAQ 로딩 중');
    expect(screen.getAllByTestId('landing-faq-skeleton-row')).toHaveLength(1);
  });

  it('Landing 전용 CSS skeleton이며 app-wide motion skeleton을 import하지 않는다', () => {
    const source = readComponentSource();

    expect(source).not.toMatch(/motion\/react/);
    expect(source).not.toMatch(/@\/components\/Skeleton|components\/Skeleton/);
    expect(source).toContain('animate-pulse');
    expect(source).toContain('motion-reduce:animate-none');
  });
});
