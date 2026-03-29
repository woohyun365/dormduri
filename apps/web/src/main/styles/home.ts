/**
 * 홈탭 반복 CSS 패턴 유틸
 *
 * 컴포넌트에서 인라인 Tailwind 클래스가 반복되는 패턴을 추출.
 * className에 직접 사용: `className={glassCard()}`
 */

// --- 1. Glassmorphism 카드 ---

type GlassColor = 'white' | 'blue' | 'purple' | 'amber' | 'red';

const GLASS_VARIANTS: Record<GlassColor, string> = {
  white: 'bg-white/40 border-white/60',
  blue: 'bg-blue-100/50 border-blue-300/60',
  purple: 'bg-purple-100/40 border-purple-200/50',
  amber: 'bg-amber-50/60 border-amber-200/80',
  red: 'bg-red-100/50 border-red-300/60',
};

export function glassCard(color: GlassColor = 'white', extra = '') {
  return `backdrop-blur-md ${GLASS_VARIANTS[color]} border rounded-xl shadow-sm ${extra}`.trim();
}

// --- 2. 섹션 카드 (흰색 테두리 카드) ---

export function sectionCard(extra = '') {
  return `bg-white rounded-2xl border-2 border-[var(--knu-border)] p-5 keep-all ${extra}`.trim();
}

// --- 3. 섹션 헤더 (제목 + 아이콘) ---

export const sectionHeader = 'flex items-center justify-between mb-4';

// --- 4. 통계 셀 ---

export const statValue = 'flex items-baseline gap-1';

type StatColor = 'default' | 'primary' | 'blue' | 'purple';

const STAT_COLORS: Record<StatColor, { value: string; unit: string }> = {
  default: {
    value: 'text-2xl font-bold text-[var(--knu-text-primary)]',
    unit: 'text-sm text-[var(--knu-text-secondary)]',
  },
  primary: {
    value: 'text-2xl font-bold text-[var(--knu-primary)]',
    unit: 'text-sm text-[var(--knu-text-secondary)]',
  },
  blue: {
    value: 'text-2xl font-bold text-blue-600',
    unit: 'text-sm text-blue-600',
  },
  purple: {
    value: 'text-2xl font-bold text-purple-600',
    unit: 'text-sm text-purple-600',
  },
};

export function statNum(color: StatColor = 'default') {
  return STAT_COLORS[color].value;
}

export function statUnit(color: StatColor = 'default') {
  return STAT_COLORS[color].unit;
}

// --- 5. 통계 라벨 (아이콘 + 텍스트) ---

export const statLabel = 'flex items-center gap-1 text-xs text-[var(--knu-text-tertiary)] mb-1';

export function statLabelAccent(color: 'blue' | 'purple' | 'amber') {
  const colors = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    amber: 'text-amber-700',
  };
  return `flex items-center gap-1 text-xs ${colors[color]} font-medium mb-1`;
}

// --- 6. 오늘 신규 배지 ---

export const todayNewBadge = 'text-xs font-bold text-green-600 ml-1';
