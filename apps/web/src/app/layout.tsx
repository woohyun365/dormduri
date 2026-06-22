import type { Metadata } from 'next';
import { createRootMetadata } from './metadata';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import AuthPanelLoader from '@/components/AuthPanelLoader';
import DevPanelLoader from '@/components/DevPanelLoader';
import SeasonDevToolLoader from '@/components/SeasonDevToolLoader';
import { WebVitalsReporter } from '@/observability/WebVitalsReporter';
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

export const metadata: Metadata = createRootMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="top-center" richColors closeButton duration={3000} />
        <AuthPanelLoader />
        <DevPanelLoader />
        <SeasonDevToolLoader />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
