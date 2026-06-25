import type { Metadata } from 'next';
import SignupPageClient from '@/auth/flows/signup/SignupPageClient';

export const metadata: Metadata = {
  title: '회원가입',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스 회원가입',
};

export default function SignupPage() {
  return <SignupPageClient />;
}
