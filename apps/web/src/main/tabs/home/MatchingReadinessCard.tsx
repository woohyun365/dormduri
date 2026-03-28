'use client';

import { motion } from 'motion/react';
import { CheckCircle, AlertCircle, ChevronRight, Sparkles, Lock } from 'lucide-react';

interface MatchingReadinessCardProps {
  hasLifestylePattern: boolean;
  hasBuildingAssigned: boolean;
  buildingName?: string;
  roomType?: string;
  optionalFieldsCompleted: number;
  optionalFieldsTotal: number;
  missingFields?: string[];
  onCompleteProfile: () => void;
}

export function MatchingReadinessCard({
  hasLifestylePattern,
  hasBuildingAssigned,
  buildingName,
  roomType,
  optionalFieldsCompleted,
  optionalFieldsTotal,
  missingFields = [],
  onCompleteProfile,
}: MatchingReadinessCardProps) {
  // 생활패턴(40%) + 건물(30%) + 선택항목(30%)
  const lifestyleScore = hasLifestylePattern ? 40 : 0;
  const buildingScore = hasBuildingAssigned ? 30 : 0;
  const optionalScore = (optionalFieldsCompleted / optionalFieldsTotal) * 30;
  const totalProgress = lifestyleScore + buildingScore + optionalScore;

  const isFullyComplete = totalProgress === 100;
  const isGated = !hasLifestylePattern || !hasBuildingAssigned;

  // 100% 완성
  if (isFullyComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 p-4 relative overflow-hidden keep-all"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-200/30 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-purple-900 text-lg">매칭 준비 완료!</h3>
              <p className="text-sm text-purple-700">프로필이 모두 완성되었어요</p>
            </div>
          </div>

          <div className="bg-white/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-purple-900">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>생활패턴 입력 완료</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-purple-900">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>
                건물 배정 완료 ({buildingName} · {roomType})
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-purple-900">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>
                선택 정보 완성 ({optionalFieldsTotal}/{optionalFieldsTotal})
              </span>
            </div>
          </div>

          <div className="mt-3 text-sm text-purple-800 bg-white/40 rounded-lg px-3 py-2">
            이제 룸메 찾기로 매칭을 시작하세요!
          </div>
        </div>
      </motion.div>
    );
  }

  // 게이팅 (필수 미완성)
  if (isGated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 rounded-2xl border-2 border-red-200 p-4 keep-all"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900">매칭 이용 불가</h3>
            <p className="text-sm text-red-700">필수 정보를 완성해주세요</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-900">매칭 준비도</span>
            <span className="text-sm font-bold text-red-600">{Math.round(totalProgress)}%</span>
          </div>
          <div className="h-2 bg-red-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-red-500 rounded-full"
            />
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {!hasLifestylePattern ? (
            <div className="flex items-start gap-2 text-sm text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="font-medium">생활패턴 입력이 필요해요 (필수)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-900">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>생활패턴 입력 완료</span>
            </div>
          )}

          {!hasBuildingAssigned ? (
            <div className="flex items-start gap-2 text-sm text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="font-medium">건물 배정이 필요해요 (필수)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-900">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>
                건물 배정 완료 ({buildingName} · {roomType})
              </span>
            </div>
          )}
        </div>

        <motion.button
          onClick={onCompleteProfile}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <span>지금 완성하기</span>
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    );
  }

  // 일반 (필수 완성, 선택 진행 중)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 keep-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[var(--knu-primary)] to-blue-700 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-[var(--knu-text-primary)]">매칭 준비도</h3>
          <p className="text-sm text-[var(--knu-text-secondary)]">거의 다 왔어요!</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--knu-text-secondary)]">완성도</span>
          <span className="text-sm font-bold text-[var(--knu-primary)]">
            {Math.round(totalProgress)}%
          </span>
        </div>
        <div className="h-2.5 bg-[var(--knu-background-alt)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[var(--knu-primary)] to-blue-600 rounded-full"
          />
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-green-900">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span>생활패턴 입력 완료</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-900">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span>
            건물 배정 완료 ({buildingName} · {roomType})
          </span>
        </div>

        {optionalFieldsCompleted < optionalFieldsTotal && (
          <div className="bg-orange-50 rounded-lg p-2 border border-orange-200">
            <div className="flex items-start gap-2 text-sm text-orange-900 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <span className="font-medium">
                선택 정보 미완성 ({optionalFieldsCompleted}/{optionalFieldsTotal})
              </span>
            </div>
            {missingFields.length > 0 && (
              <div className="ml-6 text-xs text-orange-700 space-y-0.5">
                {missingFields.map((field, i) => (
                  <div key={i}>→ {field}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <motion.button
        onClick={onCompleteProfile}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <span>프로필 완성하기</span>
        <ChevronRight className="w-4 h-4" />
      </motion.button>

      <div className="mt-3 text-xs text-[var(--knu-text-tertiary)] text-center">
        프로필을 완성하면 매칭 성공률이 높아져요
      </div>
    </motion.div>
  );
}
