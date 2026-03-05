'use client';

import { useMemo } from 'react';
import { Building2, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Z_INDEX } from '@/constants/ui';
import { LIFESTYLE_LABELS } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';

interface BuildingStatusSheetProps {
  dormitoryName: string;
  roomType: number;
  activeUsers: number;
  matchableUsers: number;
  todayNewUsers: number;
  profiles: { lifestyle: LifestyleData }[];
  onClose: () => void;
  onNavigateList: () => void;
}

interface DistributionItem {
  label: string;
  percent: number;
}

function getTopValue(
  profiles: { lifestyle: LifestyleData }[],
  field: keyof LifestyleData,
  targetValues: string[],
  labels: Record<string, string>,
): DistributionItem {
  if (profiles.length === 0) return { label: '-', percent: 0 };
  const count = profiles.filter((p) => {
    const v = p.lifestyle[field];
    return v !== null && targetValues.includes(v);
  }).length;
  const percent = Math.round((count / profiles.length) * 100);
  const topLabel = targetValues.map((v) => labels[v]).join('/');
  return { label: topLabel, percent };
}

export function BuildingStatusSheet({
  dormitoryName,
  roomType,
  activeUsers,
  matchableUsers,
  todayNewUsers,
  profiles,
  onClose,
  onNavigateList,
}: BuildingStatusSheetProps) {
  useBodyScrollLock(true);
  const containerRef = useFocusTrap(true, onClose);

  const stats = useMemo(() => {
    const nonSmoker = getTopValue(profiles, 'smoker', ['NO'], LIFESTYLE_LABELS.smoker);
    const earlyBedtime = getTopValue(
      profiles,
      'bedtime',
      ['BEFORE_22', '22_24'],
      LIFESTYLE_LABELS.bedtime,
    );
    const highCleanliness = getTopValue(
      profiles,
      'cleanliness',
      ['HIGH'],
      LIFESTYLE_LABELS.cleanliness,
    );
    return { nonSmoker, earlyBedtime, highCleanliness };
  }, [profiles]);

  return (
    <div
      className="fixed inset-0 flex items-end"
      style={{ zIndex: Z_INDEX.bottomSheet }}
      role="dialog"
      aria-modal="true"
      aria-label={`${dormitoryName} 활동 현황`}
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full bg-white rounded-t-3xl overflow-hidden">
        <div className="px-6 pt-8 pb-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-[var(--knu-primary-light)] rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[var(--knu-primary)]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">
                {dormitoryName} 활동 현황
              </h3>
              <Chip label={`${roomType}인실`} variant="badge" />
            </div>
          </div>

          {/* Section 1: Summary Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 bg-[var(--knu-background-alt)] rounded-xl">
              <p className="text-2xl font-bold text-[var(--knu-primary)]">{activeUsers}</p>
              <p className="text-xs text-[var(--knu-text-tertiary)] mt-1">활동 중</p>
            </div>
            <div className="text-center p-3 bg-[var(--knu-background-alt)] rounded-xl">
              <p className="text-2xl font-bold text-[var(--knu-text-primary)]">{matchableUsers}</p>
              <p className="text-xs text-[var(--knu-text-tertiary)] mt-1">매칭 가능</p>
            </div>
            <div className="text-center p-3 bg-[var(--knu-background-alt)] rounded-xl">
              <p className="text-2xl font-bold text-green-600">{todayNewUsers}</p>
              <p className="text-xs text-[var(--knu-text-tertiary)] mt-1">오늘 신규</p>
            </div>
          </div>

          {/* Section 2: Lifestyle Distribution */}
          <div className="mb-6">
            <p className="text-sm font-bold text-[var(--knu-text-primary)] mb-3">주요 생활 패턴</p>
            <div className="space-y-3">
              <DistributionBar label="비흡연" percent={stats.nonSmoker.percent} />
              <DistributionBar label="24시 이전 취침" percent={stats.earlyBedtime.percent} />
              <DistributionBar label="깔끔한 편" percent={stats.highCleanliness.percent} />
            </div>
          </div>

          {/* Section 3: CTA */}
          <button
            onClick={() => {
              onClose();
              onNavigateList();
            }}
            className="w-full flex items-center justify-between p-4 bg-[var(--knu-background-alt)] rounded-xl hover:bg-gray-100 transition-colors mb-2"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[var(--knu-primary)]" />
              <span className="text-sm font-semibold text-[var(--knu-text-primary)]">
                내 건물 룸메 찾기
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
          </button>
        </div>

        {/* Close Button */}
        <div className="px-5 pb-6">
          <Button variant="outline" size="lg" fullWidth onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

function DistributionBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--knu-text-secondary)]">{label}</span>
        <span className="text-xs font-bold text-[var(--knu-primary)]">{percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--knu-primary)] rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
