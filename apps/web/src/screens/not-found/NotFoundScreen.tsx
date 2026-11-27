import { BrandLogo } from '@/screens/ui/brand';
import { BackButton, controlButton } from '@/screens/ui/controls';
import { notFoundCopy } from './model/notFoundCopy';

// The screen for an address this site does not have (app/not-found.tsx). A white page in the light
// palette: the logo home on top, then the title, one line on what happened, home and back. The response
// stays 404 and Next adds noindex. Home is `/` for everyone (Owner 2026-11-17). The links home are plain
// anchors on purpose: the root not-found file ships its client parts with every page, and next/link would
// add about 3KB (gzip) to every page there (measured 2026-11-17, #913). A full load home is fine here.
export function NotFoundScreen() {
  return (
    <div
      data-palette="light"
      className="flex min-h-screen flex-col bg-layer-default font-body text-fg-neutral"
    >
      <header className="border-b border-stroke-subtle">
        <div className="mx-auto flex w-full max-w-page items-center px-gutter py-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a plain link keeps next/link out of every page (see above). */}
          <a
            href="/"
            className="flex min-h-target-primary shrink-0 items-center rounded-control focus-visible:focus-ring"
          >
            <BrandLogo />
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-reading flex-1 px-gutter py-16 lg:py-24">
        <h1 className="text-title-1 font-bold text-balance break-keep">{notFoundCopy.title}</h1>
        <p className="mt-4 text-body text-fg-muted break-keep">{notFoundCopy.description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a plain link keeps next/link out of every page (see above). */}
          <a href="/" className={controlButton}>
            {notFoundCopy.homeLabel}
          </a>
          <BackButton label={notFoundCopy.backLabel} />
        </div>
      </main>
    </div>
  );
}
