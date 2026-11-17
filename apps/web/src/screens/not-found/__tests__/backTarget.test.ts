import { describe, expect, it } from 'vitest';
import { goesBack } from '../model/backTarget';

const site = 'https://dormduri.com';
const missing = `${site}/no-such-page`;

describe('goesBack', () => {
  it('goes back after in-app moves from another page of this site', () => {
    expect(
      goesBack({ firstUrl: `${site}/main`, referrer: '', currentUrl: missing, historyLength: 3 }),
    ).toBe(true);
  });

  it('goes back when a link on another page of this site opened it', () => {
    expect(
      goesBack({
        firstUrl: missing,
        referrer: `${site}/login`,
        currentUrl: missing,
        historyLength: 2,
      }),
    ).toBe(true);
  });

  it('goes home for a typed address, an outside link or the same address', () => {
    for (const referrer of ['', 'https://example.com/post', missing]) {
      expect(goesBack({ firstUrl: missing, referrer, currentUrl: missing, historyLength: 2 })).toBe(
        false,
      );
    }
  });

  it('goes home when there is nothing to go back to', () => {
    expect(
      goesBack({
        firstUrl: `${site}/main`,
        referrer: `${site}/login`,
        currentUrl: missing,
        historyLength: 1,
      }),
    ).toBe(false);
  });

  it('goes home when a URL does not parse', () => {
    expect(
      goesBack({ firstUrl: null, referrer: 'not a url', currentUrl: missing, historyLength: 2 }),
    ).toBe(false);
  });
});
