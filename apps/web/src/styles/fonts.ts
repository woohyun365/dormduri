import { Noto_Sans_KR } from 'next/font/google';

// Variable font for the new screen layer. Only latin files are preloaded; Korean slices load
// through unicode-range when a page uses them. --font-body in tokens/semantic.tokens.json reads
// this variable.
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-noto-sans-kr',
});

export const fontVariablesClassName = notoSansKr.variable;
