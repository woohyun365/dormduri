import { ConfirmDialog } from '@/main/components/overlays/ConfirmDialog';
import { ProfileMoreMenu } from '../ProfileMoreMenu';
import { ReportSheet } from '../ReportSheet';
import type { RoommateProfile } from '@/main/model/profile';
import type { ReportReason } from '@repo/shared/social-safety/report';

interface ProfileMoreMenuInlineProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBlockConfirm: () => void;
  onOpenReportSheet: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/** BaseBottomSheet 내부에 렌더링 (absolute 위치) */
export function ProfileDetailMoreMenu({
  isOpen,
  onClose,
  onOpenBlockConfirm,
  onOpenReportSheet,
  triggerRef,
}: ProfileMoreMenuInlineProps) {
  return (
    <ProfileMoreMenu
      isOpen={isOpen}
      onClose={onClose}
      onBlock={onOpenBlockConfirm}
      onReport={onOpenReportSheet}
      triggerRef={triggerRef}
    />
  );
}

interface ProfileDetailDialogsProps {
  profile: RoommateProfile;
  showBlockConfirm: boolean;
  onCloseBlockConfirm: () => void;
  showReportSheet: boolean;
  onCloseReportSheet: () => void;
  onBlock?: (userId: string, nickname: string) => void;
  onReport?: (userId: string, reason: ReportReason, detail: string | null) => void;
  onCloseSheet: () => void;
}

/** BaseBottomSheet 바깥에 렌더링 (중첩 focus trap 방지) */
export function ProfileDetailDialogs({
  profile,
  showBlockConfirm,
  onCloseBlockConfirm,
  showReportSheet,
  onCloseReportSheet,
  onBlock,
  onReport,
  onCloseSheet,
}: ProfileDetailDialogsProps) {
  return (
    <>
      <ConfirmDialog
        isOpen={showBlockConfirm}
        onClose={onCloseBlockConfirm}
        onConfirm={() => {
          onBlock?.(profile.id, profile.nickname);
          onCloseSheet();
        }}
        title="사용자 차단"
        message={`${profile.nickname}님을 차단하시겠습니까?\n\n차단하면 해당 사용자가 목록에서 제거됩니다.`}
        confirmLabel="차단하기"
        variant="danger"
      />

      <ReportSheet
        isOpen={showReportSheet}
        onClose={onCloseReportSheet}
        onSubmit={(reason, detail) => {
          onReport?.(profile.id, reason, detail);
          onCloseReportSheet();
          onCloseSheet();
        }}
      />
    </>
  );
}
