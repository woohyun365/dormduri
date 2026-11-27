import { describe, expect, it } from 'vitest';
import { goesBack } from '../model/backTarget';

const site = 'https://dormduri.com';
const missing = `${site}/no-such-page`;
const withoutApi = { sameSiteBefore: null, currentUrl: missing } as const;

describe('goesBack', () => {
  describe('with the Navigation API', () => {
    it('goes back when the entry before is this site, whatever the referrer says', () => {
      expect(
        goesBack({
          sameSiteBefore: true,
          firstUrl: missing,
          referrer: 'https://example.com/post',
          currentUrl: missing,
          historyLength: 3,
        }),
      ).toBe(true);
    });

    it('goes home when no entry of this site comes before, even after a same-site page replaced itself', () => {
      expect(
        goesBack({
          sameSiteBefore: false,
          firstUrl: missing,
          referrer: `${site}/login`,
          currentUrl: missing,
          historyLength: 2,
        }),
      ).toBe(false);
    });
  });

  describe('without the Navigation API', () => {
    it('goes back after in-app moves from another page of this site', () => {
      expect(
        goesBack({ ...withoutApi, firstUrl: `${site}/main`, referrer: '', historyLength: 3 }),
      ).toBe(true);
    });

    it('goes back when a link on another page of this site opened it', () => {
      expect(
        goesBack({ ...withoutApi, firstUrl: missing, referrer: `${site}/login`, historyLength: 2 }),
      ).toBe(true);
    });

    it('goes home for a typed address, an outside link or the same address', () => {
      for (const referrer of ['', 'https://example.com/post', missing]) {
        expect(goesBack({ ...withoutApi, firstUrl: missing, referrer, historyLength: 2 })).toBe(
          false,
        );
      }
    });

    it('goes home when a URL does not parse', () => {
      expect(
        goesBack({ ...withoutApi, firstUrl: null, referrer: 'not a url', historyLength: 2 }),
      ).toBe(false);
    });
  });

  // The Legal screens pass both documents as one place: switching between them replaces the
  // entry, and a version link or a typed Legal address adds an entry that is still the same place.
  describe('with the same-place addresses', () => {
    const privacy = `${site}/privacy`;
    const terms = `${site}/terms`;
    const samePlacePaths = ['/privacy', '/terms'];
    const legal = { currentUrl: privacy, samePlacePaths } as const;

    it('goes home when the entry before is the same place, with or without the Navigation API', () => {
      for (const before of [terms, `${privacy}?version=2026-06-22`]) {
        expect(
          goesBack({
            ...legal,
            sameSiteBefore: true,
            entryBeforeUrl: before,
            firstUrl: `${site}/`,
            referrer: '',
            historyLength: 3,
          }),
        ).toBe(false);
        expect(
          goesBack({
            ...legal,
            sameSiteBefore: null,
            firstUrl: before,
            referrer: before,
            historyLength: 3,
          }),
        ).toBe(false);
      }
    });

    it('goes back when the entry before is another page of this site, with or without the Navigation API', () => {
      expect(
        goesBack({
          ...legal,
          sameSiteBefore: true,
          entryBeforeUrl: `${site}/`,
          firstUrl: privacy,
          referrer: '',
          historyLength: 3,
        }),
      ).toBe(true);
      expect(
        goesBack({
          ...legal,
          sameSiteBefore: null,
          firstUrl: privacy,
          referrer: `${site}/login`,
          historyLength: 2,
        }),
      ).toBe(true);
      expect(
        goesBack({
          ...legal,
          sameSiteBefore: null,
          firstUrl: `${site}/`,
          referrer: '',
          historyLength: 3,
        }),
      ).toBe(true);
    });

    it('reads the first-loaded URL and the referrer when the entry before has no known address', () => {
      expect(
        goesBack({
          ...legal,
          sameSiteBefore: true,
          entryBeforeUrl: null,
          firstUrl: terms,
          referrer: terms,
          historyLength: 3,
        }),
      ).toBe(false);
      expect(
        goesBack({
          ...legal,
          sameSiteBefore: true,
          entryBeforeUrl: null,
          firstUrl: `${site}/`,
          referrer: '',
          historyLength: 3,
        }),
      ).toBe(true);
    });

    it('still goes home when no entry of this site comes before', () => {
      expect(
        goesBack({
          ...legal,
          sameSiteBefore: false,
          entryBeforeUrl: null,
          firstUrl: `${site}/`,
          referrer: `${site}/`,
          historyLength: 2,
        }),
      ).toBe(false);
    });
  });

  it('goes home when there is nothing to go back to', () => {
    for (const sameSiteBefore of [true, null]) {
      expect(
        goesBack({
          sameSiteBefore,
          firstUrl: `${site}/main`,
          referrer: `${site}/login`,
          currentUrl: missing,
          historyLength: 1,
        }),
      ).toBe(false);
    }
  });
});
