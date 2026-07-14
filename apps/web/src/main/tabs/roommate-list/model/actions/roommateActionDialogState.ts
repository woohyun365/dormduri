import type { UseRoommateActionsResult } from '../../hooks/useRoommateActions';
import type { RoommateActionKind } from './roommateActionReasonCopy';

export function isActionDialogSubmitting(actions: UseRoommateActionsResult): boolean {
  const targetId = actions.activeDialog.target?.targetUserId;
  return targetId ? actions.isTargetPending(targetId) : false;
}

export function actionDialogErrorMessage(
  actions: UseRoommateActionsResult,
  actionKind: RoommateActionKind,
): string | null {
  if (!actions.dialogError || actions.dialogError.actionKind !== actionKind) return null;
  if (actionKind === 'matchRequest') return actions.dialogError.message;
  return `${actions.dialogError.title} ${actions.dialogError.message}`;
}
