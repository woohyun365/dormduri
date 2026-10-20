import { Noto_Sans_KR, Noto_Serif_KR } from 'next/font/google';

// Variable fonts for the new screen layer. Only latin files are preloaded; Korean slices load
// through unicode-range when a page uses them. --font-body / --font-display in
// tokens/semantic.tokens.json read these variables.
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-noto-sans-kr',
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  variable: '--font-noto-serif-kr',
});

export const fontVariablesClassName = `${notoSansKr.variable} ${notoSerifKr.variable}`;
