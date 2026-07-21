'use client';

import { useState } from 'react';
import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { REPORT_DETAIL_MAX_LENGTH } from '@repo/shared/social-safety/report';
import { getReportReasonOptions } from '@/social-safety/model/reportPresentation';
import type { ReportReason } from '@/types/report';

interface ReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, detail: string | null) => void;
}

export function ReportSheet({ isOpen, onClose, onSubmit }: ReportSheetProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');

  const handleClose = () => {
    setSelectedReason(null);
    setDetail('');
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, detail.trim() || null);
    setSelectedReason(null);
    setDetail('');
  };

  return (
    <BaseBottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title="신고하기"
      footer={
        <button
          onClick={handleSubmit}
          disabled={!selectedReason}
          className={`w-full px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
            selectedReason
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          신고하기
        </button>
      }
    >
      <div className="p-5 space-y-4">
        <p className="text-sm text-(--knu-text-secondary)">신고 사유를 선택해주세요.</p>

        <div className="space-y-2">
          {getReportReasonOptions().map(({ value: key, label }) => (
            <label
              key={key}
              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                selectedReason === key
                  ? 'border-red-400 bg-red-50'
                  : 'border-(--knu-border) hover:border-(--knu-text-tertiary)'
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                value={key}
                checked={selectedReason === key}
                onChange={() => setSelectedReason(key)}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-sm font-medium text-(--knu-text-primary)">{label}</span>
            </label>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-(--knu-text-secondary) mb-1.5">
            상세 내용 (선택)
          </label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, REPORT_DETAIL_MAX_LENGTH))}
            placeholder="추가 설명을 입력해주세요"
            rows={3}
            className="w-full px-3.5 py-3 border-2 border-(--knu-border) rounded-xl text-sm text-(--knu-text-primary) placeholder:text-(--knu-text-tertiary) resize-none focus:outline-none focus:border-(--knu-primary) transition-colors"
          />
          <p className="text-xs text-(--knu-text-tertiary) text-right mt-1">
            {detail.length}/{REPORT_DETAIL_MAX_LENGTH}
          </p>
        </div>
      </div>
    </BaseBottomSheet>
  );
}
