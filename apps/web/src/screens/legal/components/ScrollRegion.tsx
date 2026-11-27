'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// A table region that scrolls sideways on its own when the table is wider than the screen (G-LU8,
// 1.4.10's two-dimensional exception). Only while it actually overflows does it take keyboard focus,
// so the scroll is reachable without a pointer and a table that fits adds no tab stop.
export function ScrollRegion({
  label,
  labelledBy,
  className = '',
  children,
}: {
  label?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setOverflows(element.scrollWidth > element.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A value, not a literal: jsx-a11y allows an expression here (allowExpressionValues) because the
  // stop exists only while the region scrolls, which axe's scrollable-region-focusable asks for.
  const tabStop = overflows ? 0 : undefined;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      aria-labelledby={labelledBy}
      tabIndex={tabStop}
      className={className}
    >
      {children}
    </div>
  );
}
