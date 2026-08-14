import type { Metadata } from 'next';
import PasswordResetPageClient from '@/auth/flows/password-reset/PasswordResetPageClient';

export const metadata: Metadata = {
  title: '비밀번호 재설정',
  description: '강원대학교 이메일 인증으로 KNU 룸메 계정 비밀번호를 재설정합니다.',
};

export default function PasswordResetPage() {
  return <PasswordResetPageClient />;
}
