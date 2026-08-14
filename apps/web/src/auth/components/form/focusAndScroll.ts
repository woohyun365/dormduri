export function focusAndScroll(target: HTMLElement | null | undefined) {
  if (!target) return;
  target.focus?.({ preventScroll: true });
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
