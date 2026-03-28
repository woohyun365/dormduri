'use client';

import { motion } from 'motion/react';
import { Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface ShareLinkSectionProps {
  variant?: 'default' | 'emphasis';
}

export function ShareLinkSection({ variant = 'default' }: ShareLinkSectionProps) {
  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success('링크가 복사되었어요!', { duration: 2000 });
    } catch {
      toast.error('링크 복사에 실패했어요');
    }
  };

  if (variant === 'emphasis') {
    return (
      <div className="bg-blue-50 border-t-2 border-blue-200 p-4">
        <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-3">
          주변에 룸메를 구하는 친구가 있다면 함께 이용해보세요!
        </p>
        <motion.button
          onClick={handleCopyLink}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <LinkIcon className="w-4 h-4" />
          <span>링크 복사</span>
        </motion.button>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--knu-border)] p-4">
      <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed mb-3">
        주변에 룸메를 구하는 친구가 있다면 함께 이용해보세요!
      </p>
      <motion.button
        onClick={handleCopyLink}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-[var(--knu-background-alt)] hover:bg-gray-200 text-[var(--knu-text-primary)] font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 border border-[var(--knu-border)]"
      >
        <LinkIcon className="w-4 h-4" />
        <span>링크 복사</span>
      </motion.button>
    </div>
  );
}
