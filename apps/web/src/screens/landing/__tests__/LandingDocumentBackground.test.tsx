import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LandingDocumentBackground } from '../components/LandingDocumentBackground';

const frameBackground = 'rgb(11, 13, 24)';

describe('LandingDocumentBackground', () => {
  afterEach(() => {
    document.documentElement.style.backgroundColor = '';
    document.body.style.backgroundColor = '';
  });

  it('gives html and body the landing frame background while on screen and restores them after', () => {
    document.body.style.backgroundColor = 'white';
    const { unmount } = render(
      <div data-palette="dark" style={{ backgroundColor: frameBackground }}>
        <LandingDocumentBackground scheme="dark" />
      </div>,
    );

    expect(document.documentElement.style.backgroundColor).toBe(frameBackground);
    expect(document.body.style.backgroundColor).toBe(frameBackground);

    unmount();

    expect(document.documentElement.style.backgroundColor).toBe('');
    expect(document.body.style.backgroundColor).toBe('white');
  });

  it('leaves html and body alone outside a landing frame', () => {
    render(<LandingDocumentBackground scheme="dark" />);

    expect(document.documentElement.style.backgroundColor).toBe('');
    expect(document.body.style.backgroundColor).toBe('');
  });
});
