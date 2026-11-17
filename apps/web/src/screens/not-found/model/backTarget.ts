// Whether '이전 화면으로' goes back in history: only when the reader reached this page from another page
// of this site. The app first loading on another page (the navigation entry) means they came by in-app
// moves; otherwise a same-site referrer for another page means they followed a link here. A typed
// address, an outside link or a new tab (nothing to go back to) goes home instead. All URLs absolute.
export function goesBack({
  firstUrl,
  referrer,
  currentUrl,
  historyLength,
}: {
  firstUrl: string | null;
  referrer: string;
  currentUrl: string;
  historyLength: number;
}): boolean {
  if (historyLength <= 1) return false;
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
