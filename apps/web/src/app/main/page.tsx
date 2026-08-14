import type { Metadata } from 'next';
import MainRouteShell from './MainRouteShell.client';

export const metadata: Metadata = {
  title: '홈',
  description: 'KNU 룸메이트 매칭 홈',
};

export default function MainPage() {
  return <MainRouteShell />;
}
