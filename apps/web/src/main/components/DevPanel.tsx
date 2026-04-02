'use client';

import { useEffect, useState } from 'react';
import { DORMITORIES, UNASSIGNED_ID } from '@/constants/dormitory';
import type { MockUser } from '@/__fixtures__/mock-db';
/**
 * 개발 환경 전용 플로팅 패널
 *
 * - 캠퍼스별 프리셋 유저 빠른 로그인 (그룹화)
 * - 회원가입으로 생성된 유저 로그인
 * - 로그아웃 / 데이터 초기화
 * - 건물 전환
 * - 최근 인증 코드 표시 (모바일 테스트용)
 * - 시즌 상태 토글
 *
 * production 빌드에서는 렌더링하지 않는다.
 */
export function DevPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<MockUser[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('CHUNCHEON');
  const [confirmDebug, setConfirmDebug] = useState<{
    hasConversation: boolean;
    approvalCount: number;
    approvalTotal: number;
  }>({ hasConversation: false, approvalCount: 0, approvalTotal: 2 });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!isOpen) return;
    async function load() {
      const { mockDb } = await import('@/__fixtures__/mock-db');
      const user = mockDb.getCurrentUser();
      setCurrentUser(user);
      setRegisteredUsers(mockDb.getRegisteredUsers());
      if (user) {
        const { matchingApi } = await import('@/api/matching');
        const state = await matchingApi.getState(user.id);
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
    load();
  }, [isOpen]);

  if (process.env.NODE_ENV !== 'development') return null;

  async function handlePresetLogin(key: string) {
    const { PRESET_USERS } = await import('@/__fixtures__/mock-users');
    const { mockDb } = await import('@/__fixtures__/mock-db');
    const preset = PRESET_USERS[key];
    if (!preset) return;
    mockDb.setCurrentUser(preset);
    document.cookie = 'auth-token=mock-dev-token; path=/';
    window.location.href = '/';
  }

  async function handleUserLogin(user: MockUser) {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    mockDb.setCurrentUser(user);
    document.cookie = 'auth-token=mock-dev-token; path=/';
    window.location.href = '/';
  }

  async function handleLogout() {
    const { mockDb } = await import('@/__fixtures__/mock-db');
    mockDb.setCurrentUser(null);
    document.cookie = 'auth-token=; path=/; max-age=0';
    window.location.href = '/';
  }

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
    if (!currentUser) return;
    import('@/__fixtures__/mock-db').then(({ mockDb }) => {
      mockDb.updateUser(currentUser.email, { dormitoryId: dormitoryId || null });
      window.location.reload();
    });
  }

  async function handleSetConfirmState(mode: 'none' | 'self' | 'others' | 'all') {
    if (!currentUser) return;
    const { matchingApi } = await import('@/api/matching');
    await matchingApi.setConfirmState(currentUser.id, mode);
    window.location.reload();
  }

  async function handleSeedGroupScenario(
    method:
      | 'seedPairOpenScenario'
      | 'seedGroupFormingScenario'
      | 'seedGroupCandidateScenario'
      | 'seedGroupFinalScenario',
  ) {
    if (!currentUser) return;
    const { getMockMatchingService } = await import('@/__fixtures__/mock-matching-service');
    const svc = getMockMatchingService();
    const userArg = {
      id: currentUser.id,
      nickname: currentUser.nickname,
      dormitoryId: currentUser.dormitoryId,
      gender: currentUser.gender,
    };
    if (method === 'seedGroupFinalScenario') {
      const dormId = currentUser.dormitoryId ?? 'toegye';
      svc.seedGroupFinalScenario(
        userArg,
        {
          id: `${dormId}-core-b`,
          nickname: '파트너B',
          dormitoryId: dormId,
          gender: currentUser.gender,
        },
        {
          id: `${dormId}-candidate-c`,
          nickname: '합류멤버C',
          dormitoryId: dormId,
          gender: currentUser.gender,
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

      {/* 로그인 상태 */}
      <div className="bg-gray-800 rounded-lg p-2">
        <div className="text-gray-400 mb-1">로그인 상태</div>
        {currentUser ? (
          <div className="flex items-center justify-between">
            <span className="text-green-400 font-medium">
              {currentUser.nickname} ({currentUser.gender}, {currentUser.campus})
            </span>
            <button
              onClick={handleLogout}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <span className="text-gray-500">로그인 안됨</span>
        )}
      </div>

      {/* 프리셋 유저 (캠퍼스별 그룹) */}
      <PresetUserGroups
        expandedGroup={expandedGroup}
        onToggleGroup={(campus) => setExpandedGroup(expandedGroup === campus ? null : campus)}
        onLogin={handlePresetLogin}
      />

      {/* 가입 유저 */}
      {registeredUsers.length > 0 && (
        <div>
          <div className="text-gray-400 mb-1">가입 유저</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {registeredUsers.map((u) => (
              <button
                key={u.email}
                onClick={() => handleUserLogin(u)}
                className="w-full text-left px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded truncate"
              >
                {u.nickname} ({u.gender}) — {u.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 건물 전환 (로그인 시만) */}
      {currentUser && (
        <div>
          <div className="text-gray-400 mb-1">건물</div>
          <select
            value={currentUser.dormitoryId ?? ''}
            onChange={(e) => handleDormitoryChange(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-2 py-1"
          >
            <option value="">선택 안함</option>
            <option value={UNASSIGNED_ID}>미배정</option>
            {DORMITORIES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.roomType}인실, {d.gender === 'BOTH' ? '혼성' : d.gender})
              </option>
            ))}
          </select>
        </div>
      )}

      {currentUser && (
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

      {currentUser && (
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

      {/* 데이터 초기화 */}
      <button
        onClick={handleClearAll}
        className="w-full px-2 py-1.5 bg-gray-700 hover:bg-red-800 rounded text-gray-400 hover:text-white transition-colors"
      >
        데이터 초기화
      </button>
    </div>
  );
}

/** 캠퍼스별 프리셋 유저 접기/펼치기 */
function PresetUserGroups({
  expandedGroup,
  onToggleGroup,
  onLogin,
}: {
  expandedGroup: string | null;
  onToggleGroup: (campus: string) => void;
  onLogin: (key: string) => void;
}) {
  const [groups, setGroups] = useState<
    { campus: string; label: string; keys: readonly string[] }[]
  >([]);
  const [users, setUsers] = useState<Record<string, { nickname: string; gender: string }>>({});

  useEffect(() => {
    async function load() {
      const { PRESET_GROUPS, PRESET_USERS } = await import('@/__fixtures__/mock-users');
      setGroups([...PRESET_GROUPS]);
      const mapped: Record<string, { nickname: string; gender: string }> = {};
      for (const [key, user] of Object.entries(PRESET_USERS)) {
        mapped[key] = { nickname: user.nickname, gender: user.gender };
      }
      setUsers(mapped);
    }
    load();
  }, []);

  return (
    <div>
      <div className="text-gray-400 mb-1">프리셋 로그인</div>
      <div className="space-y-1">
        {groups.map((group) => (
          <div key={group.campus}>
            <button
              onClick={() => onToggleGroup(group.campus)}
              className="w-full text-left px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-between"
            >
              <span>
                {expandedGroup === group.campus ? '▾' : '▸'} {group.label}
              </span>
            </button>
            {expandedGroup === group.campus && (
              <div className="flex gap-1 mt-1 ml-2">
                {group.keys.map((key) => {
                  const u = users[key];
                  if (!u) return null;
                  const bg =
                    u.gender === 'M'
                      ? 'bg-blue-700 hover:bg-blue-600'
                      : 'bg-pink-700 hover:bg-pink-600';
                  return (
                    <button
                      key={key}
                      onClick={() => onLogin(key)}
                      className={`flex-1 px-2 py-1 ${bg} rounded font-medium`}
                    >
                      {u.nickname} ({u.gender})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
