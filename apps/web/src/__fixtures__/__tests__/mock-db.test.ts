import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mockDb } from '../mock-db';

const EMAIL_A = 'alice@kangwon.ac.kr';
const EMAIL_B = 'bob@kangwon.ac.kr';

beforeEach(() => {
  localStorage.clear();
  mockDb.resetLoginAttempts(EMAIL_A);
  mockDb.resetLoginAttempts(EMAIL_B);
});

// --- 로그인 잠금 정책 ---

describe('mockDb 로그인 잠금', () => {
  describe('recordLoginFailure', () => {
    it('4회 실패 시 잠금되지 않음', () => {
      for (let i = 0; i < 4; i++) {
        const result = mockDb.recordLoginFailure(EMAIL_A);
        expect(result.locked).toBe(false);
      }
    });

    it('5회 실패 시 잠금 상태 반환', () => {
      for (let i = 0; i < 4; i++) mockDb.recordLoginFailure(EMAIL_A);
      const result = mockDb.recordLoginFailure(EMAIL_A);
      expect(result.locked).toBe(true);
    });

    it('잠금 시 remainingSeconds가 300 (5분)', () => {
      for (let i = 0; i < 4; i++) mockDb.recordLoginFailure(EMAIL_A);
      const result = mockDb.recordLoginFailure(EMAIL_A);
      expect(result.remainingSeconds).toBe(300);
    });
  });

  describe('getLoginAttempts', () => {
    it('기록 없는 이메일은 failureCount 0', () => {
      const attempts = mockDb.getLoginAttempts(EMAIL_A);
      expect(attempts.failureCount).toBe(0);
      expect(attempts.lockedUntil).toBeNull();
    });

    it('실패 기록이 있으면 누적된 failureCount 반환', () => {
      mockDb.recordLoginFailure(EMAIL_A);
      mockDb.recordLoginFailure(EMAIL_A);
      mockDb.recordLoginFailure(EMAIL_A);
      const attempts = mockDb.getLoginAttempts(EMAIL_A);
      expect(attempts.failureCount).toBe(3);
    });

    it('잠금 만료 후 자동 리셋', () => {
      vi.useFakeTimers();
      try {
        // 5회 실패 → 잠금
        for (let i = 0; i < 5; i++) mockDb.recordLoginFailure(EMAIL_A);
        const locked = mockDb.getLoginAttempts(EMAIL_A);
        expect(locked.lockedUntil).not.toBeNull();

        // 5분 경과
        vi.advanceTimersByTime(300_000);

        const after = mockDb.getLoginAttempts(EMAIL_A);
        expect(after.failureCount).toBe(0);
        expect(after.lockedUntil).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('resetLoginAttempts', () => {
    it('실패 카운트 초기화', () => {
      mockDb.recordLoginFailure(EMAIL_A);
      mockDb.recordLoginFailure(EMAIL_A);
      mockDb.resetLoginAttempts(EMAIL_A);
      const attempts = mockDb.getLoginAttempts(EMAIL_A);
      expect(attempts.failureCount).toBe(0);
      expect(attempts.lockedUntil).toBeNull();
    });
  });

  describe('계정별 독립 추적', () => {
    it('다른 이메일의 실패가 서로 영향을 주지 않음', () => {
      mockDb.recordLoginFailure(EMAIL_A);
      mockDb.recordLoginFailure(EMAIL_A);
      mockDb.recordLoginFailure(EMAIL_A);

      mockDb.recordLoginFailure(EMAIL_B);

      expect(mockDb.getLoginAttempts(EMAIL_A).failureCount).toBe(3);
      expect(mockDb.getLoginAttempts(EMAIL_B).failureCount).toBe(1);
    });
  });

  describe('영속성 (localStorage)', () => {
    it('잠금 상태가 localStorage에 저장됨', () => {
      for (let i = 0; i < 5; i++) mockDb.recordLoginFailure(EMAIL_A);

      // localStorage에 잠금 데이터가 존재해야 한다
      const stored = localStorage.getItem('mockdb-login-attempts');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed[EMAIL_A]).toBeDefined();
      expect(parsed[EMAIL_A].failureCount).toBeGreaterThanOrEqual(5);
      expect(parsed[EMAIL_A].lockedUntil).not.toBeNull();
    });

    it('clearAll 호출 시 잠금 데이터도 초기화됨', () => {
      for (let i = 0; i < 5; i++) mockDb.recordLoginFailure(EMAIL_A);
      mockDb.clearAll();

      expect(localStorage.getItem('mockdb-login-attempts')).toBeNull();
      const attempts = mockDb.getLoginAttempts(EMAIL_A);
      expect(attempts.failureCount).toBe(0);
    });
  });
});

describe('mockDb 홈 대시보드 상태', () => {
  it('기본 홈 대시보드 상태를 반환한다', () => {
    const state = mockDb.getHomeDashboardState();
    expect(state.buildingStats.totalParticipants).toBe(135);
    expect(state.pastSeason).toBe('none');
    expect(state.nextSeasonRegisteredOverride).toBeNull();
  });

  it('패치한 홈 대시보드 상태를 저장한다', () => {
    mockDb.setHomeDashboardState({
      pastSeason: 'matched',
      nextSeasonRegisteredOverride: true,
      buildingStats: { totalParticipants: 222 },
    });

    const state = mockDb.getHomeDashboardState();
    expect(state.pastSeason).toBe('matched');
    expect(state.nextSeasonRegisteredOverride).toBe(true);
    expect(state.buildingStats.totalParticipants).toBe(222);
    expect(state.buildingStats.assignedParticipants).toBe(120);
  });

  it('resetHomeDashboardState로 기본값을 복구한다', () => {
    mockDb.setHomeDashboardState({ pastSeason: 'failed' });
    mockDb.resetHomeDashboardState();
    expect(mockDb.getHomeDashboardState().pastSeason).toBe('none');
  });
});

// --- 비밀번호 재설정 (재사용 방지) ---

describe('mockDb 비밀번호 재설정', () => {
  const EMAIL = 'reset@kangwon.ac.kr';
  const OLD_PASSWORD = 'OldPass123';
  const NEW_PASSWORD = 'NewPass456';

  beforeEach(() => {
    // 테스트 유저 생성
    mockDb.createUser({
      id: 'test-reset-user',
      email: EMAIL,
      password: OLD_PASSWORD,
      nickname: '테스트',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: null,
      lifestyle: {} as any,
      intro: '',
      lastDrinkingChangeSeasonId: null,
    });
  });

  it('동일 비밀번호로 재설정 시 실패', () => {
    const result = mockDb.resetPassword(EMAIL, OLD_PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('다른 비밀번호로 재설정 시 성공', () => {
    const result = mockDb.resetPassword(EMAIL, NEW_PASSWORD);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('미등록 이메일로 재설정 시 실패', () => {
    const result = mockDb.resetPassword('unknown@kangwon.ac.kr', NEW_PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
