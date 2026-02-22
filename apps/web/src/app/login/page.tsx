import type { Metadata } from 'next';
import Login from '@/login/Login';

export const metadata: Metadata = {
  title: 'KNU 룸메 - 로그인',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스 로그인',
};

export default function LoginPage() {
  return <Login />;
}
