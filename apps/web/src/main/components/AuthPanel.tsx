'use client';

import { useEffect, useMemo, useState } from 'react';
import { authApi } from '@/api/auth';
import type {
  DevAuthPresetGroup,
  DevAuthPresetUserSummary,
  DevAuthUserSummary,
  SessionResponse,
} from '@repo/shared/auth/response';

export function AuthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionResponse>({ authenticated: false });
  const [presetGroups, setPresetGroups] = useState<DevAuthPresetGroup[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<DevAuthUserSummary[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('CHUNCHEON');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!isOpen) return;

    async function load() {
      const [session, devUsers] = await Promise.all([authApi.getSession(), authApi.getDevUsers()]);
      setSessionStatus(session);
      setPresetGroups(devUsers.presetGroups ?? []);
      setRegisteredUsers(devUsers.users ?? []);
    }

    void load();
  }, [isOpen]);

  const hasPresetUsers = useMemo(
    () => presetGroups.some((group) => group.users.length > 0),
    [presetGroups],
  );

  if (process.env.NODE_ENV !== 'development') return null;

  async function handlePresetLogin(user: DevAuthPresetUserSummary) {
    setIsSubmitting(true);
    setError('');
    try {
      const result = await authApi.login(user.email, user.loginPassword, false);
      if (!result.success) {
        setError(result.error ?? '프리셋 로그인에 실패했습니다.');
        return;
      }
      window.location.href = '/';
    } catch {
      setError('API 서버에 연결할 수 없습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsSubmitting(true);
    setError('');
    try {
      await authApi.logout();
      window.location.href = '/';
    } catch {
      setError('로그아웃 중 네트워크 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  }

  async function handleClearAuthState() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // ignore and force client-side refresh anyway
    }
    setSessionStatus({ authenticated: false });
    window.location.href = '/';
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 left-4 z-[100] h-10 w-10 rounded-full bg-emerald-700 text-white text-sm flex items-center justify-center shadow-lg opacity-70 hover:opacity-100 transition-opacity"
        aria-label="auth 패널 열기"
      >
        A
      </button>
    );
  }

  return (
    <div className="fixed bottom-28 left-4 z-[100] w-72 bg-emerald-950 text-white text-xs rounded-xl shadow-2xl p-3 space-y-3 max-h-[70vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <span className="font-bold text-sm">Auth Panel</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-emerald-200 hover:text-white"
          aria-label="auth 패널 닫기"
        >
          X
        </button>
      </div>

      <div className="bg-emerald-900/60 rounded-lg p-2 space-y-2">
        <div className="text-emerald-200">현재 세션</div>
        <div className="text-[11px] text-emerald-300">
          세션 응답: {sessionStatus.authenticated ? 'authenticated' : 'unauthenticated'}
        </div>
        {sessionStatus.user ? (
          <>
            <div className="text-emerald-100 font-medium truncate">
              {sessionStatus.user.nickname} ({sessionStatus.user.gender},{' '}
              {sessionStatus.user.campus})
            </div>
            <div className="text-[11px] text-emerald-300 truncate">{sessionStatus.user.email}</div>
            <button
              onClick={handleLogout}
              disabled={isSubmitting}
              className="px-2 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded text-white"
            >
              로그아웃
            </button>
          </>
        ) : (
          <span className="text-emerald-300">로그인 안됨</span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-400 bg-red-950/60 p-2 text-red-100">
          {error}
        </div>
      )}

      {hasPresetUsers && (
        <AuthPresetGroups
          expandedGroup={expandedGroup}
          disabled={isSubmitting}
          groups={presetGroups}
          onToggleGroup={(campus) => setExpandedGroup(expandedGroup === campus ? null : campus)}
          onLogin={handlePresetLogin}
        />
      )}

      {registeredUsers.length > 0 && (
        <div>
          <div className="text-emerald-200 mb-1">가입 유저</div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {registeredUsers.map((user) => (
              <div key={user.email} className="w-full px-2 py-1 bg-emerald-900 rounded truncate">
                {user.nickname} ({user.gender}) — {user.email}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleClearAuthState}
        className="w-full px-2 py-1.5 bg-emerald-900 hover:bg-emerald-800 rounded text-emerald-100"
      >
        auth 상태 초기화
      </button>
    </div>
  );
}

function AuthPresetGroups({
  expandedGroup,
  disabled,
  groups,
  onToggleGroup,
  onLogin,
}: {
  expandedGroup: string | null;
  disabled: boolean;
  groups: DevAuthPresetGroup[];
  onToggleGroup: (campus: string) => void;
  onLogin: (user: DevAuthPresetUserSummary) => void;
}) {
  return (
    <div>
      <div className="text-emerald-200 mb-1">프리셋 로그인</div>
      <div className="space-y-1">
        {groups.map((group) => (
          <div key={group.campus}>
            <button
              onClick={() => onToggleGroup(group.campus)}
              className="w-full text-left px-2 py-1 bg-emerald-900 hover:bg-emerald-800 rounded flex items-center justify-between"
            >
              <span>
                {expandedGroup === group.campus ? '▾' : '▸'} {group.label}
              </span>
            </button>
            {expandedGroup === group.campus && group.users.length > 0 && (
              <div className="flex gap-1 mt-1 ml-2">
                {group.users.map((user) => {
                  const bg =
                    user.gender === 'M'
                      ? 'bg-blue-700 hover:bg-blue-600'
                      : 'bg-pink-700 hover:bg-pink-600';
                  return (
                    <button
                      key={user.presetKey}
                      onClick={() => onLogin(user)}
                      disabled={disabled}
                      className={`flex-1 px-2 py-1 ${bg} disabled:opacity-50 rounded font-medium`}
                    >
                      {user.nickname} ({user.gender})
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
