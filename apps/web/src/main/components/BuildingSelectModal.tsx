'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, Check, LoaderCircle, X } from 'lucide-react';
import type { DormitoryItem } from '@repo/shared/dormitory';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { dormitoriesApi } from '@/main/api/dormitories.api';
import { ConfirmDialog } from '@/main/components/overlays/ConfirmDialog';
import type { Campus } from '@repo/shared/identity/primitives';

interface BuildingSelectModalProps {
  campus: Campus;
  gender: 'M' | 'F';
  seasonSelectionLocked?: boolean;
  onSelect: (dormitoryId: string | null) => void;
  onClose?: () => void;
}

export function BuildingSelectModal({
  campus,
  gender,
  seasonSelectionLocked = false,
  onSelect,
  onClose,
}: BuildingSelectModalProps) {
  useBodyScrollLock(true);
  const containerRef = useFocusTrap(true, onClose ?? (() => {}));
  const warningRef = useRef<HTMLDivElement>(null);
  const queryKey = `${campus}:${gender}`;
  const [loadResult, setLoadResult] = useState<{
    queryKey: string;
    dormitories: DormitoryItem[];
    error: string | null;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [showConfirm, setShowConfirm] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    dormitoriesApi
      .getDormitories(campus, gender, { signal: controller.signal })
      .then((response) => {
        setLoadResult({
          queryKey,
          dormitories: response.items.filter((item) => item.isOperated),
          error: null,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadResult({
          queryKey,
          dormitories: [],
          error: '기숙사 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
        });
      });
    return () => controller.abort();
  }, [campus, gender, queryKey, retryKey]);

  const loading = loadResult?.queryKey !== queryKey;
  const dormitories = loading ? [] : (loadResult?.dormitories ?? []);
  const error = loading ? null : (loadResult?.error ?? null);

  useEffect(() => {
    if (selectedId && seasonSelectionLocked) {
      requestAnimationFrame(() =>
        warningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    }
  }, [selectedId, seasonSelectionLocked]);

  const selectedDorm = dormitories.find((item) => item.id === selectedId) ?? null;

  const handleConfirm = () => {
    if (selectedId === undefined) return;
    if (seasonSelectionLocked && selectedId) setShowConfirm(true);
    else onSelect(selectedId);
  };

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="배정 건물 선택"
      ref={containerRef}
      tabIndex={-1}
    >
      {onClose && (
        <div className="flex justify-end px-5 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="size-5 text-(--knu-text-secondary)" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-5 py-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-(--knu-primary-light)">
              <Building2 className="size-8 text-(--knu-primary)" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-(--knu-text-primary)">
              배정 건물을 선택해주세요
            </h1>
            <p className="text-sm leading-relaxed text-(--knu-text-secondary)">
              배정받은 기숙사 건물을 선택하면
              <br />
              같은 건물 룸메이트를 찾을 수 있어요
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 transition-all ${selectedId === null ? 'border-orange-400 bg-orange-50' : 'border-dashed border-(--knu-border) bg-(--knu-background-alt) hover:border-gray-300'}`}
            >
              <span className="font-semibold text-(--knu-text-secondary) keep-all">
                아직 배정 결과를 확인하지 못했어요
              </span>
              {selectedId === null && (
                <span className="flex size-6 items-center justify-center rounded-full bg-orange-500">
                  <Check className="size-4 text-white" />
                </span>
              )}
            </button>

            {selectedId === null && (
              <div className="flex items-start gap-3 rounded-xl border-2 border-orange-200 bg-orange-50 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-500" />
                <div>
                  <p className="mb-1 text-sm font-semibold text-orange-800">
                    건물을 선택하면 룸메 탐색을 시작할 수 있어요
                  </p>
                  <p className="text-xs leading-relaxed text-orange-700 keep-all">
                    배정 결과가 나오면 프로필 탭에서 배정 건물을 설정하고 매칭을 시작해보세요.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div
                className="flex items-center justify-center gap-2 rounded-2xl border border-(--knu-border) p-8 text-sm text-(--knu-text-secondary)"
                role="status"
                aria-live="polite"
              >
                <LoaderCircle className="size-4 animate-spin" />
                기숙사 목록을 불러오는 중이에요
              </div>
            )}
            {error && (
              <div
                className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4"
                role="alert"
              >
                <p className="text-sm text-red-700">{error}</p>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setLoadResult(null);
                    setRetryKey((key) => key + 1);
                  }}
                >
                  다시 시도
                </Button>
              </div>
            )}
            {!loading &&
              !error &&
              dormitories.map((dormitory) => (
                <div key={dormitory.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(dormitory.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 transition-all ${selectedId === dormitory.id ? 'border-(--knu-primary) bg-(--knu-primary-light)' : 'border-(--knu-border) bg-white hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-(--knu-text-primary)">
                        {dormitory.name}
                      </span>
                      <Chip label={`${dormitory.roomType}인실`} variant="badge" />
                    </div>
                    {selectedId === dormitory.id && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-(--knu-primary)">
                        <Check className="size-4 text-white" />
                      </span>
                    )}
                  </button>
                  {seasonSelectionLocked && selectedId === dormitory.id && (
                    <div
                      ref={warningRef}
                      className="mt-2 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">
                          시즌 중에는 건물을 변경할 수 없어요
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-red-600">
                          오입력 시 문의하기를 통해 관리자에게 요청해주세요.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t-2 border-(--knu-border) bg-white px-5 py-4">
        <div className="mx-auto max-w-md">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={selectedId === undefined || loading || Boolean(error)}
            onClick={handleConfirm}
          >
            {selectedDorm
              ? `${selectedDorm.name} 선택 완료`
              : selectedId === null
                ? '미배정으로 진행'
                : '선택 완료'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title={`${selectedDorm?.name ?? ''}(${selectedDorm?.roomType ?? 2}인실)을 선택합니다`}
        message={'시즌 중에는 건물을 변경할 수 없습니다.\n건물 오입력 시 관리자에게 문의해주세요.'}
        confirmLabel="확인"
        cancelLabel="취소"
        onConfirm={() => {
          if (selectedId) onSelect(selectedId);
          setShowConfirm(false);
        }}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
}
