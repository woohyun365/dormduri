import { useEffect } from 'react';

const lockState = { count: 0 };

export function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;

    lockState.count += 1;
    document.body.style.overflow = 'hidden';

    return () => {
      lockState.count -= 1;
      if (lockState.count === 0) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen]);
}
