'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from './Button';

/**
 * A modal layer: a right drawer for a form or a detail, or a centered confirmation of a risky action (design guide ⑥).
 * The native <dialog> opened with showModal() makes the rest of the page inert, so focus stays inside; Escape and the
 * close button (the drawer's header, the confirmation's footer beside its action) close it, and focus goes back to the
 * control that opened it.
 */
export function Overlay({
  id,
  title,
  onClose,
  footer,
  description,
  variant = 'drawer',
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly onClose: () => void;
  readonly footer?: ReactNode;
  readonly description?: ReactNode;
  readonly variant?: 'drawer' | 'confirm';
  readonly children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // The control that had focus before the dialog opened, caught once (a Strict Mode re-run would catch the dialog).
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    const active = document.activeElement;
    opener.current ??= active instanceof HTMLElement && !dialog?.contains(active) ? active : null;
    if (dialog && !dialog.open) dialog.showModal();
    const back = opener;
    return () => back.current?.focus();
  }, []);
  const close = () => ref.current?.close();
  // Escape closes the dialog through the same close() as its button: the browser's own Escape closing does not follow a
  // key event a script sends (the story play), and this keeps both on one path.
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  };
  const frame =
    variant === 'drawer'
      ? 'm-0 ml-auto h-full max-h-none w-drawer max-w-full border-l'
      : 'm-auto w-drawer rounded-card border';
  return (
    <dialog
      ref={ref}
      id={id}
      role={variant === 'confirm' ? 'alertdialog' : undefined}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onClose={onClose}
      onKeyDown={onKeyDown}
      className={`flex-col overflow-y-auto border-stroke-subtle bg-layer-default p-0 text-fg-neutral shadow-overlay backdrop:bg-scrim open:flex ${frame}`}
    >
      {/* The dialog scrolls as a whole (it holds focusable controls, axe scrollable-region-focusable); the header and the
          footer stay in view. */}
      <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-stroke-subtle bg-layer-default px-card py-4">
        <h2 id={`${id}-title`} className="text-title-2 font-semibold text-fg-neutral">
          {title}
        </h2>
        {variant === 'drawer' ? (
          <Button tone="secondary" size="sm" onClick={close}>
            닫기
          </Button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-card">
        {description ? (
          <p id={`${id}-description`} className="text-body text-fg-neutral">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {footer ? (
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-stroke-subtle bg-layer-default px-card py-4">
          {variant === 'confirm' ? (
            <Button tone="secondary" onClick={close}>
              닫기
            </Button>
          ) : null}
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
