'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  HelpCircle,
  FileText,
  Mail,
  ChevronRight,
  Trash2,
  AlertCircle,
  Building2,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { DORM_HOMEPAGE_URL } from '@/constants/dormitory-guide';
import { ComingSoonBadge } from '@/components/ComingSoonBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SectionHeading } from '@/components/SectionHeading';
import Link from 'next/link';

interface SettingsTabProps {
  onShowGuide: () => void;
}

export default function SettingsTab({ onShowGuide }: SettingsTabProps) {
  const router = useRouter();
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b-2 border-[var(--knu-border)] px-5 py-6">
        <h1 className="text-2xl font-bold text-[var(--knu-text-primary)]">설정</h1>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        {/* Account */}
        <section>
          <SectionHeading
            icon={<Shield className="w-5 h-5 text-[var(--knu-primary)]" />}
            title="계정"
          />
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] divide-y-2 divide-[var(--knu-border)]">
            <div className="relative p-4 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  비밀번호 변경
                </span>
              </div>
              <ComingSoonBadge />
            </div>
            <div className="relative p-4 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  내 정보 다운로드
                </span>
              </div>
              <ComingSoonBadge />
            </div>
            <button
              onClick={() => setLogoutDialog(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  로그아웃
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            </button>
          </div>
        </section>

        {/* 안내 및 지원 */}
        <section>
          <SectionHeading
            icon={<HelpCircle className="w-5 h-5 text-[var(--knu-primary)]" />}
            title="안내 및 지원"
          />
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] divide-y-2 divide-[var(--knu-border)]">
            <button
              onClick={onShowGuide}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  기숙사 안내 다시 보기
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            </button>
            <a
              href={DORM_HOMEPAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  학생생활관 홈페이지
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            </a>
            <Link
              href="/terms"
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  이용약관
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            </Link>
            <Link
              href="/privacy"
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  개인정보처리방침
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            </Link>
            <a
              href="mailto:knu-roommate@kangwon.ac.kr"
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                  문의하기
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            </a>
          </div>
        </section>

        {/* App Info */}
        <section>
          <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">앱 정보</h2>
          <div className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[var(--knu-text-tertiary)]">버전</span>
              <span className="text-sm font-semibold text-[var(--knu-text-primary)]">1.0.0</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[var(--knu-text-tertiary)]">최근 업데이트</span>
              <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                2026.02.21
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--knu-text-tertiary)]">개발자</span>
              <span className="text-sm font-semibold text-[var(--knu-text-primary)]">KNU Team</span>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <SectionHeading
            icon={<AlertCircle className="w-5 h-5" />}
            title="위험 영역"
            variant="danger"
          />
          <div className="bg-white rounded-2xl border-2 border-red-200 p-5">
            <div className="mb-4">
              <h3 className="font-bold text-[var(--knu-text-primary)] mb-2">계정 삭제</h3>
              <p className="text-sm text-[var(--knu-text-secondary)] mb-4">
                계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
              </p>
            </div>
            <button
              onClick={() => setDeleteDialog(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 border-2 border-red-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              계정 삭제하기
            </button>
          </div>
        </section>

        {/* Footer Spacing */}
        <div className="h-8" />
      </div>

      {/* Logout Confirm Dialog */}
      <ConfirmDialog
        isOpen={logoutDialog}
        onClose={() => setLogoutDialog(false)}
        onConfirm={() => {
          // TODO: clear auth state
          router.push('/login');
        }}
        title="로그아웃"
        message="로그아웃 하시겠습니까?"
        confirmLabel="로그아웃"
      />

      {/* Delete Account Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => {
          // TODO: API call to delete account
          router.push('/login');
        }}
        title="계정 삭제"
        message="정말로 계정을 삭제하시겠습니까?\n\n모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다."
        confirmLabel="삭제하기"
        variant="danger"
      />
    </div>
  );
}
