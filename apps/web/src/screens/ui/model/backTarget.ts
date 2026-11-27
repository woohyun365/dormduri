// Whether '이전 화면으로' goes back in history: only when the entry just before this page belongs to
// this site. A browser with the Navigation API says so directly: its entry list holds only this
// site's contiguous entries, so an index above 0 means the one before is ours (`sameSiteBefore`). Without
// it, the page's first-loaded URL (the navigation entry) or the referrer being another page of this site
// stands in; that guess can be wrong when a page of this site replaced its own entry on the way here. A
// typed address, an outside link or a new tab (nothing to go back to) goes home instead. URLs absolute.
//
// `samePlacePaths` names addresses that count as this same place (the Legal screens pass both
// documents): an entry before at one of them is not a page to go back to. The Navigation API branch
// reads the path of the entry just before (`entryBeforeUrl`); when that address is unknown (null), the
// first-loaded URL and the referrer decide, as without the API.
export function goesBack({
  sameSiteBefore,
  entryBeforeUrl = null,
  firstUrl,
  referrer,
  currentUrl,
  historyLength,
  samePlacePaths = [],
}: {
  sameSiteBefore: boolean | null;
  entryBeforeUrl?: string | null;
  firstUrl: string | null;
  referrer: string;
  currentUrl: string;
  historyLength: number;
  samePlacePaths?: readonly string[];
}): boolean {
  if (historyLength <= 1) return false;
  if (sameSiteBefore === false) return false;
  if (sameSiteBefore === true) {
    if (samePlacePaths.length === 0) return true;
    const before = entryBeforeUrl ? parse(entryBeforeUrl) : null;
    if (before !== null) return !samePlacePaths.includes(before.pathname);
    // The entry before has no known address: read the first-loaded URL and the referrer below.
  }
  const current = parse(currentUrl);
  if (current === null) return false;
  return [firstUrl, referrer].some((url) => {
    const other = url ? parse(url) : null;
    return (
      other !== null &&
      other.origin === current.origin &&
      other.pathname !== current.pathname &&
      !samePlacePaths.includes(other.pathname)
    );
  });
}

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
