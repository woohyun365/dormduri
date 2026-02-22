export interface Season {
  isActive: boolean;
  name: string;
  roomSelectionStart: Date;
  roomSelectionEnd: Date;
}

// Mock data (추후 API 연동)
export const CURRENT_SEASON: Season = {
  isActive: true,
  name: '2026년 1학기',
  roomSelectionStart: new Date('2026-02-11'),
  roomSelectionEnd: new Date('2026-02-12'),
};
