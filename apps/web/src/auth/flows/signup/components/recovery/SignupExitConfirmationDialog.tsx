import { SignupDecisionDialog } from './SignupDecisionDialog';

interface SignupExitConfirmationDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SignupExitConfirmationDialog({
  isOpen,
  onCancel,
  onConfirm,
}: SignupExitConfirmationDialogProps) {
  return (
    <SignupDecisionDialog
      isOpen={isOpen}
      title="가입을 그만둘까요?"
      description="이 탭에 입력한 정보가 삭제돼요."
      secondaryLabel="계속 작성"
      primaryLabel="나가기"
      primaryVariant="danger"
      onSecondary={onCancel}
      onPrimary={onConfirm}
    />
  );
}
