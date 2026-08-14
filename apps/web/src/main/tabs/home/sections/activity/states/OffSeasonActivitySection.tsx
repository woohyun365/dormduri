import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  CheckCircle2,
  Inbox,
  MessageCircle,
  Send,
  UserRound,
  XCircle,
} from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import { OffSeasonDetailModal } from '../dialogs/OffSeasonDetailModal';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type { OffSeasonDetailModalKind } from '../model/activityTypes';
import { resolveOffSeasonActivityContent } from '../model/activityContent';

export function OffSeasonActivitySection({ viewModel }: { viewModel: HomeDashboardViewModel }) {
  const content = resolveOffSeasonActivityContent(viewModel);
  const [detailModal, setDetailModal] = useState<OffSeasonDetailModalKind | null>(null);
  const lastSeason = viewModel.seasonSummary.lastSeason;
  const Icon = content.icon;
  const canShowDetailActions = Boolean(lastSeason?.viewerHadRegistration);

  return (
    <section className={sectionCard()} aria-labelledby="home-activity-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-(--knu-primary)">{content.eyebrow}</p>
          <h2 id="home-activity-title" className="font-bold text-(--knu-text-primary)">
            {content.title}
          </h2>
        </div>
        <Icon className="h-5 w-5 text-(--knu-primary)" aria-hidden="true" />
      </div>

      {lastSeason?.viewerHadRegistration ? (
        <div className="space-y-3">
          <ViewerResultCard
            finalResult={lastSeason.viewerActivity.finalResult}
            matchedPartnerNickname={lastSeason.viewerActivity.matchedPartnerNickname}
          />
          <div className="grid grid-cols-3 gap-2">
            <ActivityStatCell
              icon={Inbox}
              label="받은 요청"
              value={lastSeason.viewerActivity.receivedRequestCount}
              tone="purple"
            />
            <ActivityStatCell
              icon={Send}
              label="보낸 요청"
              value={lastSeason.viewerActivity.sentRequestCount}
              tone="blue"
            />
            <ActivityStatCell
              icon={MessageCircle}
              label="대화"
              value={lastSeason.viewerActivity.conversationCount}
              tone="green"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed whitespace-pre-line text-(--knu-text-secondary) sm:whitespace-normal">
          {content.body}
        </div>
      )}

      {canShowDetailActions && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <motion.button
            type="button"
            onClick={() => setDetailModal('activity')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-(--knu-border) bg-(--knu-background-alt) px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors hover:bg-gray-100"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span>이전 시즌 상세 보기</span>
          </motion.button>
          {viewModel.capabilities.canViewMatchHistory && (
            <motion.button
              type="button"
              onClick={() => setDetailModal('profile')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-(--knu-border) bg-white px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors hover:bg-(--knu-background-alt)"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span>이전 시즌 프로필 확인</span>
            </motion.button>
          )}
        </div>
      )}

      <OffSeasonDetailModal
        kind={detailModal}
        viewModel={viewModel}
        onClose={() => setDetailModal(null)}
      />
    </section>
  );
}

function ViewerResultCard({
  finalResult,
  matchedPartnerNickname,
}: {
  finalResult: NonNullable<
    HomeDashboardViewModel['seasonSummary']['lastSeason']
  >['viewerActivity']['finalResult'];
  matchedPartnerNickname: string | null;
}) {
  const matched = finalResult === 'MATCHED' || finalResult === 'UNMATCHED_AFTER_SUCCESS';
  const ResultIcon = matched ? CheckCircle2 : XCircle;

  return (
    <div
      className={
        matched
          ? 'rounded-xl border border-green-200 bg-green-50 p-4'
          : 'rounded-xl border border-gray-200 bg-gray-50 p-4'
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <ResultIcon
          className={matched ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-gray-500'}
          aria-hidden="true"
        />
        <span className={matched ? 'font-bold text-green-700' : 'font-bold text-gray-700'}>
          {matched ? '매칭 완료' : '매칭 미성사'}
        </span>
      </div>
      <p className={matched ? 'text-sm text-green-800' : 'text-sm text-gray-600'}>
        {matched ? (
          matchedPartnerNickname ? (
            <>
              <span className="font-extrabold text-green-700">{matchedPartnerNickname}</span>님과
              매칭이 성사되었어요.
            </>
          ) : (
            '지난 시즌에 매칭이 성사되었어요.'
          )
        ) : (
          '지난 시즌에는 확정된 매칭이 없었어요.'
        )}
      </p>
    </div>
  );
}
function ActivityStatCell({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: 'purple' | 'blue' | 'green' | 'gray';
}) {
  const toneClass = {
    purple: {
      icon: 'bg-purple-100 text-purple-600',
      value: 'text-purple-600',
    },
    blue: {
      icon: 'bg-blue-100 text-blue-600',
      value: 'text-blue-600',
    },
    green: {
      icon: 'bg-green-100 text-green-600',
      value: 'text-green-600',
    },
    gray: {
      icon: 'bg-slate-100 text-slate-600',
      value: 'text-slate-700',
    },
  }[tone];

  return (
    <div className="rounded-xl bg-(--knu-background-alt) p-3 text-center">
      <div
        className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${toneClass.icon}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className={`text-lg font-bold ${toneClass.value}`}>{value}</p>
      <p className="text-xs text-(--knu-text-tertiary)">{label}</p>
    </div>
  );
}
