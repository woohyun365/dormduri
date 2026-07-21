'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, ExternalLink, LoaderCircle, Phone } from 'lucide-react';
import type { DormitoryGuideResponse } from '@repo/shared/dormitory';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { dormitoriesApi } from '@/main/api/dormitories.api';
import { BaseBottomSheet } from '@/main/components/overlays/BaseBottomSheet';
import { buildDormitoryGuidePresentation } from './dormitoryGuidePresentation';

interface DormitoryGuideSheetProps {
  dormitoryId: string;
  onClose: () => void;
}

interface GuideLoadResult {
  readonly dormitoryId: string;
  readonly response: DormitoryGuideResponse | null;
  readonly error: string | null;
}

export function DormitoryGuideSheet({ dormitoryId, onClose }: DormitoryGuideSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [loadResult, setLoadResult] = useState<GuideLoadResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void dormitoriesApi
      .getDormitoryGuide(dormitoryId, { signal: controller.signal })
      .then((response) => {
        setLoadResult({ dormitoryId, response, error: null });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadResult({
          dormitoryId,
          response: null,
          error: '기숙사 안내를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
        });
      });

    return () => controller.abort();
  }, [dormitoryId, retryKey]);

  const currentResult = loadResult?.dormitoryId === dormitoryId ? loadResult : null;
  const guide = currentResult?.response
    ? buildDormitoryGuidePresentation(currentResult.response)
    : null;
  const error = currentResult?.error ?? null;
  const totalCards = 4;
  const isLastCard = currentIndex === totalCards - 1;

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element) setCurrentIndex(Math.round(element.scrollLeft / element.clientWidth));
  }, []);

  const scrollToNext = () => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTo({
        left: (currentIndex + 1) * element.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  return (
    <BaseBottomSheet
      isOpen
      onClose={onClose}
      title={`${guide?.dormitory.name ?? '기숙사'} 안내`}
      footer={
        guide ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={isLastCard ? onClose : scrollToNext}
          >
            {isLastCard ? '확인' : '다음'}
          </Button>
        ) : error ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
              닫기
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                setLoadResult(null);
                setRetryKey((key) => key + 1);
              }}
            >
              다시 시도
            </Button>
          </div>
        ) : undefined
      }
    >
      {!guide ? (
        <div
          className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
          role="status"
          aria-live="polite"
        >
          {error ? (
            <>
              <AlertTriangle className="size-8 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </>
          ) : (
            <>
              <LoaderCircle className="size-7 animate-spin text-(--knu-primary)" />
              <p className="text-sm text-(--knu-text-secondary)">기숙사 안내를 불러오는 중이에요</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
          >
            <GuideCard
              icon={<Building2 className="size-6 text-(--knu-primary)" />}
              iconClass="bg-(--knu-primary-light)"
              title={`${guide.dormitory.name} 안내`}
              subtitle={`${guide.dormitory.roomType}인실`}
            >
              <InfoBlock label="화장실" value={guide.bathroomLabel} />
              <div className="rounded-xl bg-(--knu-background-alt) p-4">
                <p className="mb-2 text-xs text-(--knu-text-tertiary)">편의시설</p>
                <div className="flex flex-wrap gap-1.5">
                  {guide.guide.facilities.map((facility) => (
                    <Chip key={facility} label={facility} variant="badge" />
                  ))}
                </div>
              </div>
            </GuideCard>
            <GuideCard
              icon={<AlertTriangle className="size-6 text-red-500" />}
              iconClass="bg-red-100"
              title="꼭 알아두세요"
              subtitle="위반 시 벌점 또는 퇴사"
            >
              {guide.commonRules.map((rule) => (
                <div
                  key={rule.label}
                  className="flex items-start gap-3 rounded-xl bg-(--knu-background-alt) p-3.5"
                >
                  <span className="text-lg">{rule.emoji}</span>
                  <div>
                    <p className="text-xs text-(--knu-text-tertiary)">{rule.label}</p>
                    <p className="text-sm font-semibold text-(--knu-text-primary)">{rule.value}</p>
                  </div>
                </div>
              ))}
            </GuideCard>
            <GuideCard
              icon={<Phone className="size-6 text-blue-600" />}
              iconClass="bg-blue-100"
              title="문제가 생기면"
              subtitle="연락처를 저장해두세요"
            >
              <Contact
                label={`${guide.dormitory.name} 시설 고장`}
                value={guide.guide.repairContact}
                emphasized
              />
              {guide.guide.diningContact && (
                <Contact label={`${guide.dormitory.name} 식당`} value={guide.guide.diningContact} />
              )}
              {guide.emergencyContacts.map((contact) => (
                <Contact key={contact.label} {...contact} />
              ))}
            </GuideCard>
            <GuideCard
              icon={<ExternalLink className="size-6 text-green-600" />}
              iconClass="bg-green-100"
              title="더 알아보기"
              subtitle="공식 홈페이지에서 상세 정보 확인"
            >
              <a
                href={guide.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl bg-(--knu-background-alt) p-4 transition-colors hover:bg-gray-100"
              >
                <span className="text-sm font-semibold text-(--knu-text-primary)">
                  학생생활관 홈페이지
                </span>
                <ExternalLink className="size-4 text-(--knu-text-tertiary)" />
              </a>
            </GuideCard>
          </div>
          <div
            className="flex justify-center gap-2 py-3"
            aria-label={`${currentIndex + 1} / ${totalCards}`}
          >
            {Array.from({ length: totalCards }, (_, index) => (
              <span
                key={index}
                className={`size-2 rounded-full ${index === currentIndex ? 'bg-(--knu-primary)' : 'bg-gray-300'}`}
              />
            ))}
          </div>
        </>
      )}
    </BaseBottomSheet>
  );
}

function GuideCard({
  icon,
  iconClass,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-full snap-start px-6 pb-4 pt-8">
      <div className="mb-5 flex items-center gap-3">
        <div className={`flex size-12 items-center justify-center rounded-xl ${iconClass}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-bold text-(--knu-text-primary)">{title}</h3>
          <p className="text-xs text-(--knu-text-tertiary)">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-(--knu-background-alt) p-4">
      <p className="mb-1 text-xs text-(--knu-text-tertiary)">{label}</p>
      <p className="text-sm font-semibold text-(--knu-text-primary)">{value}</p>
    </div>
  );
}
function Contact({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3.5 ${emphasized ? 'bg-(--knu-primary-light)' : 'bg-(--knu-background-alt)'}`}
    >
      <p
        className={`mb-1 text-xs ${emphasized ? 'font-semibold text-(--knu-primary)' : 'text-(--knu-text-tertiary)'}`}
      >
        {label}
      </p>
      <a
        href={`tel:${value.replace(/-/g, '')}`}
        className={`text-sm font-semibold ${emphasized ? 'text-(--knu-primary)' : 'text-(--knu-text-primary)'}`}
      >
        {value}
      </a>
    </div>
  );
}
