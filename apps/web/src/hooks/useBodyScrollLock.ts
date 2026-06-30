import { useEffect } from 'react';

interface BodyScrollLockSnapshot {
  bodyOverflow: string;
  bodyPaddingRight: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  documentOverflow: string;
  scrollY: number;
}

const lockState: { count: number; snapshot: BodyScrollLockSnapshot | null } = {
  count: 0,
  snapshot: null,
};

function getCurrentScrollY() {
  return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
}

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
  const scrollY = getCurrentScrollY();
  const scrollbarWidth = getScrollbarWidth();

  lockState.snapshot = {
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    documentOverflow: documentElement.style.overflow,
    scrollY,
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = scrollY > 0 ? `-${scrollY}px` : '0px';
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  documentElement.style.overflow = 'hidden';

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
  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.left = snapshot.bodyLeft;
  body.style.right = snapshot.bodyRight;
  body.style.width = snapshot.bodyWidth;
  documentElement.style.overflow = snapshot.documentOverflow;
  window.scrollTo(0, snapshot.scrollY);
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
