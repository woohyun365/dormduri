import { render, screen } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BrandLogo } from '../BrandLogo';

type ImageSource = string | { src: string };
const srcOf = (src: ImageSource) => (typeof src === 'string' ? src : src.src);

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: ImageSource }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={srcOf(src)} alt={alt} className={className} />
  ),
}));

describe('BrandLogo', () => {
  it('reads as one name, 돔두리, with the mark left out of the accessibility tree', () => {
    const { container } = render(<BrandLogo />);

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: '돔두리' }).tagName.toLowerCase()).toBe('svg');
    const mark = container.querySelector('img');
    expect(mark).toHaveAttribute('alt', '');
    expect(container).not.toHaveTextContent(/\S/);
  });

  it('picks the mark cut by tone: the color cut by default, the white cut for dark surfaces', () => {
    const { container, rerender } = render(<BrandLogo />);
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(/logo-mark\.png/);

    rerender(<BrandLogo tone="white" />);
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(/logo-mark-white\.png/);
  });

  it('draws the header size by default and the footer size with size lg', () => {
    const { container, rerender } = render(<BrandLogo />);
    expect(container.querySelector('img')).toHaveClass('size-7');
    expect(container.querySelector('svg')).toHaveClass('h-8');

    rerender(<BrandLogo size="lg" />);
    expect(container.querySelector('img')).toHaveClass('size-10');
    expect(container.querySelector('svg')).toHaveClass('h-12');
  });

  it('colors 돔 and the Latin line with the brand token and 두리 with the surrounding text color', () => {
    const { container } = render(<BrandLogo />);

    const groups = container.querySelectorAll('svg > g > g');
    expect([...groups].map((group) => group.getAttribute('class'))).toEqual([
      'stroke-fg-brand',
      'stroke-current',
      'stroke-fg-brand',
    ]);
  });
});
