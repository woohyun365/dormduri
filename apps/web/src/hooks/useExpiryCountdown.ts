'use client';

import { useState, useEffect } from 'react';

interface ExpiryCountdown {
  timeLeft: string;
  isExpired: boolean;
  totalSeconds: number;
}

function calcRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatHMS(totalSeconds: number): string {
  if (totalSeconds <= 0) return '만료됨';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 카운트다운 텍스트는 클라이언트 시각 기반이므로 SSR과 불가피하게 다를 수 있음.
// 사용처에서 suppressHydrationWarning 적용 필요.
export function useExpiryCountdown(expiresAt: string): ExpiryCountdown {
  const isValid = Number.isFinite(new Date(expiresAt).getTime());

  const [totalSeconds, setTotalSeconds] = useState(() => (isValid ? calcRemaining(expiresAt) : 0));

  useEffect(() => {
    if (!isValid) {
      setTotalSeconds(0);
      return;
    }
    const id = setInterval(() => {
      const remaining = calcRemaining(expiresAt);
      setTotalSeconds(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isValid]);

  return {
    timeLeft: formatHMS(totalSeconds),
    isExpired: totalSeconds <= 0,
    totalSeconds,
  };
}
