import React from 'react';
import { renderWithProviders, screen } from '../../test/render';
import { describe, it, expect } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('loading 상태에서 disabled + aria-busy 적용', () => {
    renderWithProviders(<Button loading>전송</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('...');
  });

  it('loading=false 시 정상 렌더링', () => {
    renderWithProviders(<Button>전송</Button>);
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).toHaveTextContent('전송');
  });

  it('disabled + loading 동시 적용 시 disabled 유지', () => {
    renderWithProviders(
      <Button disabled loading>
        전송
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
