export function focusAndScroll(target: HTMLElement | null | undefined) {
  if (!target) return;
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  target.focus?.();
}
