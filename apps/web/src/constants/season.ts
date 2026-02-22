export interface Season {
  isActive: boolean;
  name: string;
  roomSelectionStart: string;
  roomSelectionEnd: string;
}

// Mock data (추후 API 연동)
// ISO 문자열로 저장하여 서버/클라이언트 hydration 불일치 방지
export const CURRENT_SEASON: Season = {
  isActive: true,
  name: '2026년 1학기',
  roomSelectionStart: '2026-02-11',
  roomSelectionEnd: '2026-02-12',
};
