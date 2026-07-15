import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnsupportedGroupLegacySnapshot } from '../__stories__/legacy/unsupported-group/UnsupportedGroupLegacySnapshot';

describe('UnsupportedGroupLegacySnapshot', () => {
  it('미출시 historical evidence임을 명확히 표시한다', () => {
    render(<UnsupportedGroupLegacySnapshot />);

    expect(screen.getByTestId('unsupported-group-legacy-snapshot')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3인실 그룹 매칭 (미출시)' })).toBeInTheDocument();
    expect(screen.getByText(/현재 제품과 API는 2인 매칭만 제공/)).toBeInTheDocument();
  });
});
