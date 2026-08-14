import { useState } from 'react';
import type { RoommateProfileDetailState } from '../../roommate-list/hooks/useRoommateProfileDetail';
import type { RoommateActionTargetSnapshot } from '../../roommate-list/hooks/useRoommateActions';
import { RoommateProfileDetailDialog } from '../../roommate-list/overlays/RoommateProfileDetailDialog';
import type { MatchingRequestCardView } from '../model/matching-request-view';
import type { MatchingRequestCommands } from '../sections/requests/PairRequestSection';
import {
  MatchRequestDecisionDialog,
  type MatchRequestDecision,
} from './MatchRequestDecisionDialog';

export function MatchRequestProfileDialog({
  state,
  request,
  commands,
  onClose,
  onRetry,
  actionPendingTargetIds = [],
  onBlock,
  onReport,
  suspended = false,
}: {
  readonly state: RoommateProfileDetailState;
  readonly request: MatchingRequestCardView | null;
  readonly commands: MatchingRequestCommands;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly actionPendingTargetIds?: readonly string[];
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly suspended?: boolean;
}) {
  const [decisionDialog, setDecisionDialog] = useState<{
    readonly decision: MatchRequestDecision;
    readonly request: MatchingRequestCardView;
  } | null>(null);
  const actionName = decisionDialog
    ? decisionDialog.decision === 'accept'
      ? 'acceptRequest'
      : decisionDialog.decision === 'reject'
        ? 'rejectRequest'
        : 'cancelRequest'
    : null;
  const decisionPending = Boolean(
    decisionDialog && actionName && commands.isPending(actionName, decisionDialog.request.id),
  );

  const openDecision = (decision: MatchRequestDecision) => {
    if (!request) return;
    setDecisionDialog({ decision, request });
  };

  const submitDecision = async () => {
    if (!decisionDialog) return;
    const result = await commands[decisionDialog.decision](decisionDialog.request.id);
    if (result !== 'error') {
      setDecisionDialog(null);
      onClose();
    }
  };

  return (
    <>
      <RoommateProfileDetailDialog
        state={state}
        suspended={suspended || decisionDialog !== null}
        title="요청 상대 프로필"
        onClose={onClose}
        onRetry={onRetry}
        actionPendingTargetIds={actionPendingTargetIds}
        onBlock={onBlock}
        onReport={onReport}
        pendingRequestActions={
          request
            ? {
                pending:
                  commands.isPending('acceptRequest', request.id) ||
                  commands.isPending('rejectRequest', request.id) ||
                  commands.isPending('cancelRequest', request.id),
                onAccept:
                  request.direction === 'RECEIVED' ? () => openDecision('accept') : undefined,
                onCancel: request.direction === 'SENT' ? () => openDecision('cancel') : undefined,
              }
            : undefined
        }
      />
      <MatchRequestDecisionDialog
        decision={decisionDialog?.decision ?? null}
        nickname={decisionDialog?.request.nickname ?? ''}
        pending={decisionPending}
        onClose={() => setDecisionDialog(null)}
        onConfirm={() => void submitDecision()}
      />
    </>
  );
}
