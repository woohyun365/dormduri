const AVATAR_COLORS = [
  { bg: 'bg-rose-100', text: 'text-rose-600' },
  { bg: 'bg-orange-100', text: 'text-orange-600' },
  { bg: 'bg-amber-100', text: 'text-amber-600' },
  { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  { bg: 'bg-cyan-100', text: 'text-cyan-600' },
  { bg: 'bg-blue-100', text: 'text-blue-600' },
  { bg: 'bg-violet-100', text: 'text-violet-600' },
  { bg: 'bg-pink-100', text: 'text-pink-600' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getAvatarColor(nickname: string): { bg: string; text: string } {
  return AVATAR_COLORS[hashString(nickname) % AVATAR_COLORS.length]!;
}
