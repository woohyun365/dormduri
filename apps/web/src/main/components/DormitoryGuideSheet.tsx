'use client';

import { useState, useRef, useCallback } from 'react';
import { Building2, AlertTriangle, Phone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import {
  DORMITORY_GUIDE,
  COMMON_RULES,
  EMERGENCY_CONTACTS,
  DORM_HOMEPAGE_URL,
} from '@/constants/dormitory-guide';

interface DormitoryGuideSheetProps {
  dormitoryId: string;
  onClose: () => void;
}

export function DormitoryGuideSheet({ dormitoryId, onClose }: DormitoryGuideSheetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isUnassigned = dormitoryId === UNASSIGNED_ID;
  const dormitory = !isUnassigned ? getDormitoryById(dormitoryId) : null;
  const guideInfo = !isUnassigned ? DORMITORY_GUIDE[dormitoryId] : null;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setCurrentIndex(Math.round(scrollLeft / clientWidth));
  }, []);

  const scrollToNext = () => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: (currentIndex + 1) * clientWidth,
      behavior: 'smooth',
    });
  };

  const totalCards = 4;
  const isLastCard = currentIndex === totalCards - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full bg-white rounded-t-3xl overflow-hidden">
        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Card 1: Building Info */}
          <div className="min-w-full snap-start px-6 pt-8 pb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-[var(--knu-primary-light)] rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[var(--knu-primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">
                  {dormitory ? dormitory.name : '기숙사'} 안내
                </h3>
                {dormitory && <Chip label={`${dormitory.roomType}인실`} variant="badge" />}
              </div>
            </div>

            {guideInfo ? (
              <div className="space-y-4">
                <div className="bg-[var(--knu-background-alt)] rounded-xl p-4">
                  <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">화장실</p>
                  <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                    {guideInfo.bathroomType}
                  </p>
                </div>
                <div className="bg-[var(--knu-background-alt)] rounded-xl p-4">
                  <p className="text-xs text-[var(--knu-text-tertiary)] mb-2">편의시설</p>
                  <div className="flex flex-wrap gap-1.5">
                    {guideInfo.facilities.map((f) => (
                      <span
                        key={f}
                        className="px-2.5 py-1 bg-white text-[var(--knu-text-secondary)] text-xs font-medium rounded-full border border-[var(--knu-border)]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <p className="text-sm text-orange-800 leading-relaxed">
                  건물이 배정되면 해당 건물의 편의시설, 화장실 구조 등 상세 정보를 확인할 수 있어요.
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Key Rules */}
          <div className="min-w-full snap-start px-6 pt-8 pb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">꼭 알아두세요</h3>
                <p className="text-xs text-[var(--knu-text-tertiary)]">위반 시 벌점 또는 퇴사</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {COMMON_RULES.map((rule) => (
                <div
                  key={rule.label}
                  className="flex items-start gap-3 bg-[var(--knu-background-alt)] rounded-xl p-3.5"
                >
                  <span className="text-lg leading-none mt-0.5">{rule.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--knu-text-tertiary)]">{rule.label}</p>
                    <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                      {rule.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Contacts */}
          <div className="min-w-full snap-start px-6 pt-8 pb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">문제가 생기면</h3>
                <p className="text-xs text-[var(--knu-text-tertiary)]">연락처를 저장해두세요</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {guideInfo && (
                <div className="bg-[var(--knu-primary-light)] rounded-xl p-3.5">
                  <p className="text-xs text-[var(--knu-primary)] font-semibold mb-1">
                    {dormitory?.name} 시설 고장
                  </p>
                  <a
                    href={`tel:${guideInfo.repairContact.replace(/-/g, '')}`}
                    className="text-sm font-bold text-[var(--knu-primary)]"
                  >
                    {guideInfo.repairContact}
                  </a>
                </div>
              )}
              {guideInfo?.diningContact && (
                <div className="bg-[var(--knu-background-alt)] rounded-xl p-3.5">
                  <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">
                    {dormitory?.name} 식당
                  </p>
                  <a
                    href={`tel:${guideInfo.diningContact.replace(/-/g, '')}`}
                    className="text-sm font-semibold text-[var(--knu-text-primary)]"
                  >
                    {guideInfo.diningContact}
                  </a>
                </div>
              )}
              {EMERGENCY_CONTACTS.map((c) => (
                <div key={c.label} className="bg-[var(--knu-background-alt)] rounded-xl p-3.5">
                  <p className="text-xs text-[var(--knu-text-tertiary)] mb-1">{c.label}</p>
                  <a
                    href={`tel:${c.value.replace(/-/g, '')}`}
                    className="text-sm font-semibold text-[var(--knu-text-primary)]"
                  >
                    {c.value}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: External Link */}
          <div className="min-w-full snap-start px-6 pt-8 pb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--knu-text-primary)]">더 알아보기</h3>
                <p className="text-xs text-[var(--knu-text-tertiary)]">
                  공식 홈페이지에서 상세 정보 확인
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href={DORM_HOMEPAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-[var(--knu-background-alt)] rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                    학생생활관 홈페이지
                  </p>
                  <p className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">
                    knudorm.kangwon.ac.kr
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--knu-text-tertiary)]" />
              </a>
              <a
                href="https://knudorm.kangwon.ac.kr/content/K10"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-[var(--knu-background-alt)] rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                    생활수칙 및 상벌점
                  </p>
                  <p className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">상세 규정 확인</p>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--knu-text-tertiary)]" />
              </a>
              <a
                href="https://knudorm.kangwon.ac.kr/content/K08"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-[var(--knu-background-alt)] rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
                    생활관 둘러보기
                  </p>
                  <p className="text-xs text-[var(--knu-text-tertiary)] mt-0.5">
                    건물 사진 및 시설 안내
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--knu-text-tertiary)]" />
              </a>
            </div>
          </div>
        </div>

        {/* Hide scrollbar for webkit */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Dot Indicators */}
        <div className="flex justify-center gap-2 py-3">
          {Array.from({ length: totalCards }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? 'bg-[var(--knu-primary)]' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <div className="px-5 pb-6">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={isLastCard ? onClose : scrollToNext}
          >
            {isLastCard ? '확인' : '다음'}
          </Button>
        </div>
      </div>
    </div>
  );
}
