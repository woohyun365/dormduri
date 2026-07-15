'use client';

import { useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import type { TabId } from '@/types/profile';
import type {
  LegacyActiveMatch,
  LegacyMatchRequest,
  LegacyPairProfile,
  LegacyPairUser,
  LegacyPastSeasonData,
} from './model';

type RequestTab = 'sent' | 'received';

export interface LegacyMatchingTabBaselineProps {
  user: LegacyPairUser;
  matchRequests: LegacyMatchRequest[];
  activeMatch: LegacyActiveMatch | null;
  profiles: LegacyPairProfile[];
  pastSeasons: LegacyPastSeasonData[];
  onCancelRequest: (requestId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onConfirmMatch: (requestId: string) => void;
  onRevokeConfirmMatch: (requestId: string) => void;
  onEndConversation: (requestId: string) => void;
  onEndMatch: () => void;
  onNavigate: (tab: TabId) => void;
  initialSection?: 'current' | 'past';
  initialRequestTab?: RequestTab;
}

/** 제품 runtime과 분리된 Phase 0의 2인 legacy 화면 증거입니다. */
export function LegacyMatchingTabBaseline({
  user,
  matchRequests,
  activeMatch,
  profiles,
  onCancelRequest,
  onAcceptRequest,
  onRejectRequest,
  onConfirmMatch,
  onEndConversation,
  onEndMatch,
  onNavigate,
  initialRequestTab = 'sent',
}: LegacyMatchingTabBaselineProps) {
  const [requestTab, setRequestTab] = useState<RequestTab>(initialRequestTab);
  const [scoreSort, setScoreSort] = useState(false);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  if (activeMatch) {
    return (
      <section
        className="mx-auto max-w-md space-y-4 p-5"
        aria-label="legacy pair matching baseline"
      >
        <p className="text-xs font-semibold text-(--knu-text-tertiary)">
          Baseline · Legacy · Pair only
        </p>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-800">서로의 룸메이트가 되었어요</p>
          <h2 className="mt-2 text-xl font-extrabold text-(--knu-text-primary)">
            {activeMatch.partnerNickname}
          </h2>
          <p className="mt-1 text-sm text-(--knu-text-secondary)">
            매칭도 {activeMatch.matchScore}%
          </p>
          <button
            type="button"
            onClick={onEndMatch}
            className="mt-4 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700"
          >
            매칭 취소
          </button>
        </div>
      </section>
    );
  }

  const visible = matchRequests.filter((request) =>
    requestTab === 'sent' ? request.fromUserId === user.id : request.toUserId === user.id,
  );
  const ordered = scoreSort ? [...visible].reverse() : visible;
  return (
    <section className="mx-auto max-w-md space-y-4 p-5" aria-label="legacy pair matching baseline">
      <p className="text-xs font-semibold text-(--knu-text-tertiary)">
        Baseline · Legacy · Pair only
      </p>
      <div className="flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="요청 구분">
        {(['sent', 'received'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={requestTab === tab}
            onClick={() => setRequestTab(tab)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${requestTab === tab ? 'bg-white text-(--knu-primary)' : 'text-(--knu-text-secondary)'}`}
          >
            {tab === 'sent' ? '보낸 요청' : '받은 요청'}
          </button>
        ))}
      </div>
      {requestTab === 'received' ? (
        <button
          type="button"
          role="switch"
          aria-checked={scoreSort}
          aria-label="받은 요청을 매칭도 우선으로 정렬"
          onClick={() => setScoreSort((value) => !value)}
          className="rounded-xl border border-(--knu-border) px-3 py-2 text-sm"
        >
          매칭도 우선
        </button>
      ) : null}
      {ordered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--knu-border) bg-white p-6 text-center text-sm text-(--knu-text-secondary)">
          대기 중인 요청이 없어요.
        </div>
      ) : (
        ordered.map((request) => {
          const partnerId = request.fromUserId === user.id ? request.toUserId : request.fromUserId;
          const partner = profileById.get(partnerId);
          return (
            <article
              key={request.id}
              className="rounded-2xl border border-(--knu-border) bg-white p-4"
            >
              <h2 className="font-bold">{partner?.nickname ?? '대화 상대'}</h2>
              <p className="mt-1 text-sm text-(--knu-text-secondary)">
                {request.message ?? '남긴 메시지가 없어요.'}
              </p>
              <div className="mt-3 flex gap-2">
                {request.status === 'IN_CONVERSATION' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onConfirmMatch(request.id)}
                      className="rounded-xl bg-(--knu-primary) px-3 py-2 text-sm font-semibold text-white"
                    >
                      <Check className="mr-1 inline size-4" />
                      확정하기
                    </button>
                    <button
                      type="button"
                      onClick={() => onEndConversation(request.id)}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      <X className="mr-1 inline size-4" />
                      대화 종료
                    </button>
                  </>
                ) : requestTab === 'received' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onRejectRequest(request.id)}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      onClick={() => onAcceptRequest(request.id)}
                      className="rounded-xl bg-(--knu-primary) px-3 py-2 text-sm font-semibold text-white"
                    >
                      <MessageCircle className="mr-1 inline size-4" />
                      수락하기
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCancelRequest(request.id)}
                    className="rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-700"
                  >
                    요청 취소
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}
      <button
        type="button"
        onClick={() => onNavigate('list')}
        className="text-sm font-semibold text-(--knu-primary)"
      >
        룸메 찾기로 이동
      </button>
    </section>
  );
}
