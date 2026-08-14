import { Button } from '@/components/ui/Button';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { UI_LAYER } from '@/styles/layers';

interface SignupDecisionDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  secondaryLabel: string;
  primaryLabel: string;
  onSecondary: () => void;
  onPrimary: () => void;
  primaryVariant?: 'primary' | 'danger';
  dismissible?: boolean;
}

export function SignupDecisionDialog({
  isOpen,
  title,
  description,
  secondaryLabel,
  primaryLabel,
  onSecondary,
  onPrimary,
  primaryVariant = 'primary',
  dismissible = true,
}: SignupDecisionDialogProps) {
  useBodyScrollLock(isOpen);
  const dialogRef = useFocusTrap(isOpen, dismissible ? onSecondary : () => undefined);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="signup-decision-dialog-title"
      aria-describedby="signup-decision-dialog-description"
      tabIndex={-1}
      className="fixed inset-0 flex items-end justify-center bg-black/45 px-0 sm:items-center sm:px-5"
      style={{ zIndex: UI_LAYER.dialog }}
      onClick={dismissible ? onSecondary : undefined}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="signup-decision-dialog-title"
          className="text-lg font-bold text-(--knu-text-primary)"
        >
          {title}
        </h2>
        <p
          id="signup-decision-dialog-description"
          className="mt-2 keep-all text-sm leading-6 text-(--knu-text-secondary)"
        >
          {description}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" fullWidth onClick={onSecondary}>
            {secondaryLabel}
          </Button>
          <Button variant={primaryVariant} fullWidth onClick={onPrimary}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
