// Whether '이전 화면으로' goes back in history: only when the entry just before this page belongs to
// this site. A browser with the Navigation API says so directly: its entry list holds only this
// site's contiguous entries, so an index above 0 means the one before is ours (`sameSiteBefore`). Without
// it, the page's first-loaded URL (the navigation entry) or the referrer being another page of this site
// stands in; that guess can be wrong when a page of this site replaced its own entry on the way here. A
// typed address, an outside link or a new tab (nothing to go back to) goes home instead. URLs absolute.
export function goesBack({
  sameSiteBefore,
  firstUrl,
  referrer,
  currentUrl,
  historyLength,
}: {
  sameSiteBefore: boolean | null;
  firstUrl: string | null;
  referrer: string;
  currentUrl: string;
  historyLength: number;
}): boolean {
  if (historyLength <= 1) return false;
  if (sameSiteBefore !== null) return sameSiteBefore;
  const current = parse(currentUrl);
  if (current === null) return false;
  return [firstUrl, referrer].some((url) => {
    const other = url ? parse(url) : null;
    return other !== null && other.origin === current.origin && other.pathname !== current.pathname;
  });
}

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
