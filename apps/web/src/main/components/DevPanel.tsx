'use client';

import { useEffect, useState } from 'react';
import { DORMITORIES, UNASSIGNED_ID } from '@/constants/dormitory';
import type { SessionResponse } from '@repo/shared/auth/response';
import { authApi } from '@/api/auth';
/**
 * 개발 환경 전용 플로팅 패널
 *
 * - 건물 전환
 * - 매칭 확정/3인실 시나리오 seed
 * - 데이터 초기화
 *
 * auth 빠른 로그인/로그아웃은 AuthPanel로 분리했다.
 * production 빌드에서는 렌더링하지 않는다.
 */
function getDevSessionDormitoryId(user: SessionResponse['user']): string | null {
  if (!user || !('dormitoryId' in user)) return null;
  return typeof user.dormitoryId === 'string' ? user.dormitoryId : null;
}

export function DevPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionResponse>({ authenticated: false });
  const [confirmDebug, setConfirmDebug] = useState<{
    hasConversation: boolean;
    approvalCount: number;
    approvalTotal: number;
  }>({ hasConversation: false, approvalCount: 0, approvalTotal: 2 });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!isOpen) return;
    async function load() {
      const session = await authApi.getSession();
      setSessionStatus(session);
      if (session.user) {
        const { matchingApi } = await import('@/api/matching');
        const state = await matchingApi.getState(session.user.id);
        const conversation = state.requests.find((request) => request.status === 'IN_CONVERSATION');
        setConfirmDebug({
          hasConversation: !!conversation,
          approvalCount: conversation?.approvalUserIds?.length ?? 0,
          approvalTotal:
            state.activeMatch?.kind === 'group' && state.activeMatch.groupStage === 'GROUP_FORMING'
              ? (state.activeMatch.groupMemberCount ?? 3)
              : 2,
        });
      } else {
        setConfirmDebug({ hasConversation: false, approvalCount: 0, approvalTotal: 2 });
      }
    }
    void load();
  }, [isOpen]);

  if (process.env.NODE_ENV !== 'development') return null;

  async function handleClearAll() {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    const { getMockMatchingService, MockMatchingService } =
      await import('@/__fixtures__/mock-matching-service');
    mockDb.clearAll();
    getMockMatchingService().clearState();
    MockMatchingService.setPresetOverride('auto');
    document.cookie = 'auth-token=; path=/; max-age=0';
    window.location.href = '/';
  }

  function handleDormitoryChange(dormitoryId: string) {
    if (!sessionStatus.user) return;
    import('@/api/profile').then(({ profileApi }) => {
      void profileApi.updateProfile({ dormitoryId: dormitoryId || null }).then(() => {
        window.location.reload();
      });
    });
  }

  async function handleSetConfirmState(mode: 'none' | 'self' | 'others' | 'all') {
    if (!sessionStatus.user) return;
    const { matchingApi } = await import('@/api/matching');
    await matchingApi.setConfirmState(sessionStatus.user.id, mode);
    window.location.reload();
  }

  async function handleSeedGroupScenario(
    method:
      | 'seedPairOpenScenario'
      | 'seedGroupFormingScenario'
      | 'seedGroupCandidateScenario'
      | 'seedGroupFinalScenario',
  ) {
    if (!sessionStatus.user) return;
    const { getMockMatchingService } = await import('@/__fixtures__/mock-matching-service');
    const svc = getMockMatchingService();
    const userArg = {
      id: sessionStatus.user.id,
      nickname: sessionStatus.user.nickname,
      dormitoryId: getDevSessionDormitoryId(sessionStatus.user),
      gender: sessionStatus.user.gender,
    };
    if (method === 'seedGroupFinalScenario') {
      const dormId = getDevSessionDormitoryId(sessionStatus.user) ?? 'toegye';
      svc.seedGroupFinalScenario(
        userArg,
        {
          id: `${dormId}-core-b`,
          nickname: '파트너B',
          dormitoryId: dormId,
          gender: sessionStatus.user.gender,
        },
        {
          id: `${dormId}-candidate-c`,
          nickname: '합류멤버C',
          dormitoryId: dormId,
          gender: sessionStatus.user.gender,
        },
      );
    } else {
      svc[method](userArg);
    }
    window.location.reload();
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 right-4 z-[100] w-10 h-10 rounded-full bg-gray-800 text-white text-sm flex items-center justify-center shadow-lg opacity-60 hover:opacity-100 transition-opacity"
        aria-label="개발 패널 열기"
      >
        D
      </button>
    );
  }

  return (
    <div className="fixed bottom-28 right-4 z-[100] w-72 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3 space-y-3 max-h-[70vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <span className="font-bold text-sm">Dev Panel</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
          aria-label="개발 패널 닫기"
        >
          X
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-2">
        <div className="text-gray-400 mb-1">현재 사용자 컨텍스트</div>
        {sessionStatus.user ? (
          <span className="text-green-400 font-medium">
            {sessionStatus.user.nickname} ({sessionStatus.user.gender}, {sessionStatus.user.campus})
          </span>
        ) : (
          <span className="text-gray-500">로그인 필요</span>
        )}
      </div>

      {sessionStatus.user && (
        <div>
          <div className="text-gray-400 mb-1">건물</div>
          <select
            value={getDevSessionDormitoryId(sessionStatus.user) ?? ''}
            onChange={(e) => handleDormitoryChange(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-2 py-1"
          >
            <option value="">선택 안함</option>
            <option value={UNASSIGNED_ID}>미배정</option>
            {DORMITORIES.map((dormitory) => (
              <option key={dormitory.id} value={dormitory.id}>
                {dormitory.name} ({dormitory.roomType}인실,{' '}
                {dormitory.gender === 'BOTH' ? '혼성' : dormitory.gender})
              </option>
            ))}
          </select>
        </div>
      )}

      {sessionStatus.user && (
        <div className="bg-gray-800 rounded-lg p-2 space-y-2">
          <div className="text-gray-400">확정 완료 테스트</div>
          {confirmDebug.hasConversation ? (
            <>
              <p className="text-gray-300">
                현재 승인: {confirmDebug.approvalCount}/{confirmDebug.approvalTotal}
              </p>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => handleSetConfirmState('none')}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  초기화
                </button>
                <button
                  onClick={() => handleSetConfirmState('self')}
                  className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded"
                >
                  나만 완료
                </button>
                <button
                  onClick={() => handleSetConfirmState('others')}
                  className="px-2 py-1 bg-amber-700 hover:bg-amber-600 rounded"
                >
                  상대만 완료
                </button>
                <button
                  onClick={() => handleSetConfirmState('all')}
                  className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded"
                >
                  둘 다 완료
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-500">대화 중 상태가 없어 테스트할 수 없습니다.</p>
          )}
        </div>
      )}

      {sessionStatus.user && (
        <div className="bg-gray-800 rounded-lg p-2 space-y-2">
          <div className="text-gray-400">3인실 그룹 시나리오</div>
          <button
            onClick={() => handleSeedGroupScenario('seedPairOpenScenario')}
            className="w-full px-2 py-1.5 bg-sky-700 hover:bg-sky-600 rounded text-white"
          >
            PAIR_OPEN (A-B 코어 + C 요청)
          </button>
          <button
            onClick={() => handleSeedGroupScenario('seedGroupFormingScenario')}
            className="w-full px-2 py-1.5 bg-amber-700 hover:bg-amber-600 rounded text-white"
          >
            GROUP_FORMING (3인 대화 중)
          </button>
          <button
            onClick={() => handleSeedGroupScenario('seedGroupCandidateScenario')}
            className="w-full px-2 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded text-white"
          >
            C 시점 (개인 → 그룹 요청)
          </button>
          <button
            onClick={() => handleSeedGroupScenario('seedGroupFinalScenario')}
            className="w-full px-2 py-1.5 bg-green-700 hover:bg-green-600 rounded text-white"
          >
            GROUP_FINAL (3인 확정)
          </button>
          <p className="text-[11px] text-gray-500">
            현재 로그인 사용자를 개인(C)로 두고, 3인실 그룹(A·B)에 요청을 보낸 상태를 만듭니다.
          </p>
        </div>
      )}

      <button
        onClick={handleClearAll}
        className="w-full px-2 py-1.5 bg-gray-700 hover:bg-red-800 rounded text-gray-400 hover:text-white transition-colors"
      >
        데이터 초기화
      </button>
    </div>
  );
}
