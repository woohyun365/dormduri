'use client';

import { useState, useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);

  const threshold = 80;
  const rotate = useTransform(y, [0, threshold], [0, 360]);
  const opacity = useTransform(y, [0, threshold], [0, 1]);

  const handleDragEnd = async (_: unknown, info: PanInfo) => {
    if (info.offset.y > threshold && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    y.set(0);
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center"
        style={{ y: useTransform(y, (val) => val - 50), opacity }}
      >
        <motion.div
          className="w-10 h-10 bg-(--knu-primary) rounded-full flex items-center justify-center shadow-lg"
          style={{ rotate }}
        >
          <RefreshCw className="w-5 h-5 text-white" />
        </motion.div>
      </motion.div>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className={isRefreshing ? 'pointer-events-none' : ''}
      >
        {children}
      </motion.div>

      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/10 z-50 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 bg-(--knu-primary) rounded-full flex items-center justify-center shadow-xl"
          >
            <RefreshCw className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
