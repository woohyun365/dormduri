import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import DevPanelLoader from '@/components/DevPanelLoader';
import SeasonDevToolLoader from '@/components/SeasonDevToolLoader';
import './globals.css';
import '../styles/knu.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'KNU 룸메',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스',
  icons: { icon: '/knu_logo.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <DevPanelLoader />
        <SeasonDevToolLoader />
      </body>
    </html>
  );
}
