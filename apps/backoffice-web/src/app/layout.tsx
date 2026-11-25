import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: '돔두리 백오피스',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  // Every page renders per request: the CSP nonce exists only on a request (README §5, src/proxy.ts),
  // and the screens read the backoffice API per request without a cache (README §1).
  await connection();
  return (
    <html lang="ko">
      {/* Korean text wraps between words, a word longer than its line still breaks, and a paragraph avoids a lone short
          last line (design guide ⑦). */}
      <body className="bg-layer-basement text-fg-neutral antialiased break-keep wrap-break-word text-pretty">
        {children}
      </body>
    </html>
  );
}
