'use client';

interface ScrollToButtonProps {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}

export function ScrollToButton({ targetId, children, className }: ScrollToButtonProps) {
  const handleClick = () => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <span
      onClick={handleClick}
      className={className}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      {children}
    </span>
  );
}
