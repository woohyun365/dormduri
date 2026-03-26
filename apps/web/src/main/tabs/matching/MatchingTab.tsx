'use client';

import { Handshake } from 'lucide-react';

export default function MatchingTab() {
  return (
    <div className="px-4 py-6">
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Handshake className="w-12 h-12 text-gray-300" />
        <p className="text-sm text-[var(--knu-text-secondary)]">매칭 탭 준비 중</p>
      </div>
    </div>
  );
}
