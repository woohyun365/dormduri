'use client';

interface ScrollToButtonProps {
  targetId: string;
  className?: string;
  children: string;
}

export function ScrollToButton({ targetId, className, children }: ScrollToButtonProps) {
  const handleClick = () => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}
