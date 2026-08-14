import { Building2 } from 'lucide-react';
import { HomeResponsiveSheet } from '../../../overlays/HomeResponsiveSheet';
import { EmptyDetailCard } from '../ActivityDetailRows';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';

export function OperatedDormitoryListModal({
  isOpen,
  viewModel,
  onClose,
}: {
  isOpen: boolean;
  viewModel: HomeDashboardViewModel;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <HomeResponsiveSheet
      eyebrow="시즌 오픈"
      title="운영 기숙사 리스트"
      description="이번 시즌에 선택할 수 있는 기숙사와 호실 선택 기준일이에요."
      icon={Building2}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
        >
          확인
        </button>
      }
    >
      {viewModel.operatedDormitories.length > 0 ? (
        <div className="space-y-2">
          {viewModel.operatedDormitories.map((dormitory) => (
            <div
              key={dormitory.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-(--knu-text-primary)">
                  {dormitory.name}
                </p>
                <p className="mt-0.5 text-xs text-(--knu-text-tertiary)">
                  호실 선택일 {dormitory.roomSelectionDate}
                </p>
              </div>
              <Building2 className="size-4 shrink-0 text-sky-600" aria-hidden="true" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyDetailCard message="아직 등록된 운영 기숙사 정보가 없어요." />
      )}
    </HomeResponsiveSheet>
  );
}
