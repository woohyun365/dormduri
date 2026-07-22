import { useEffect } from 'react';

interface BodyScrollLockSnapshot {
  bodyOverflow: string;
  bodyPaddingRight: string;
  documentOverflow: string;
}

const lockState: { count: number; snapshot: BodyScrollLockSnapshot | null } = {
  count: 0,
  snapshot: null,
};

function getScrollbarWidth() {
  const documentWidth = document.documentElement.clientWidth;

  if (documentWidth <= 0) return 0;

  return Math.max(0, window.innerWidth - documentWidth);
}

function shouldCompensateScrollbar() {
  const scrollbarGutter = window.getComputedStyle(document.documentElement).scrollbarGutter;

  return !scrollbarGutter.includes('stable');
}

function applyBodyScrollLock() {
  const body = document.body;
  const documentElement = document.documentElement;
  const scrollbarWidth = getScrollbarWidth();

  lockState.snapshot = {
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    documentOverflow: documentElement.style.overflow,
  };

  // `hidden`은 새 scroll container를 만들어 background의 sticky header 기준을 바꾼다.
  // `clip`은 scrolling 자체를 막되 scroll container는 만들지 않아 현재 sticky 위치를 보존한다.
  body.style.overflow = 'clip';
  documentElement.style.overflow = 'clip';

  if (scrollbarWidth > 0 && shouldCompensateScrollbar()) {
    const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
  }
}

function restoreBodyScrollLock() {
  const snapshot = lockState.snapshot;

  if (!snapshot) return;

  const body = document.body;
  const documentElement = document.documentElement;

  body.style.overflow = snapshot.bodyOverflow;
  body.style.paddingRight = snapshot.bodyPaddingRight;
  documentElement.style.overflow = snapshot.documentOverflow;
  lockState.snapshot = null;
}

export function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;

    if (lockState.count === 0) {
      applyBodyScrollLock();
    }

    lockState.count += 1;

    return () => {
      lockState.count = Math.max(0, lockState.count - 1);
      if (lockState.count === 0) {
        restoreBodyScrollLock();
      }
    };
  }, [isOpen]);
}
