import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileDetailMoreMenu, ProfileDetailDialogs } from '../ProfileDetailModeration';
import type { RoommateProfile } from '@/types/profile';
import { createRef } from 'react';

vi.mock('../../ProfileMoreMenu', () => ({
  ProfileMoreMenu: ({
    isOpen,
    onBlock,
    onReport,
  }: {
    isOpen: boolean;
    onBlock: () => void;
    onReport: () => void;
    onClose: () => void;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
  }) =>
    isOpen ? (
      <div data-testid="more-menu">
        <button onClick={onBlock}>block</button>
        <button onClick={onReport}>report</button>
      </div>
    ) : null,
}));

vi.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel: string;
    variant: string;
  }) =>
    isOpen ? (
      <button data-testid="confirm-dialog" onClick={onConfirm}>
        confirm
      </button>
    ) : null,
}));

vi.mock('../../ReportSheet', () => ({
  ReportSheet: ({
    isOpen,
    onSubmit,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string, detail: string | null) => void;
  }) =>
    isOpen ? (
      <button data-testid="report-sheet" onClick={() => onSubmit('SPAM', null)}>
        report
      </button>
    ) : null,
}));

const mockProfile: RoommateProfile = {
  id: 'user-1',
  nickname: '테스트유저',
  gender: 'M',
  dormitoryId: 'dasan',
  lifestyle: {
    bedtime: '22_24',
    wakeTime: '07_08',
    sleepHabit: 'NONE',
    sleepEnvironment: 'QUIET',
    noiseSensitivity: 'NORMAL',
    smokingBehavior: 'NO',
    indoorEating: 'OK',
    phoneBehavior: 'BRIEF',
    earphoneUsage: 'STUDY',
    cleanLevel: 'WEEKLY_1_2',
    drinkingFrequency: 'SOMETIMES',
    relationshipStyle: 'CASUAL',
    temperatureSensitivity: 'NORMAL',
    smokingTolerance: 'E_CIG_OK',
    phoneTolerance: 'BRIEF_OK',
    earphoneExpectation: 'STUDY',
    sleepEnvPreference: 'EARPHONE_OK',
    cleanExpectation: 'BASIC',
    drinkingTolerance: 'SOMETIMES_OK',
  },
  intro: '',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
  matchScore: 70,
};

describe('ProfileDetailMoreMenu', () => {
  it('isOpen=true일 때 메뉴를 렌더링한다', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <ProfileDetailMoreMenu
        isOpen
        onClose={vi.fn()}
        onOpenBlockConfirm={vi.fn()}
        onOpenReportSheet={vi.fn()}
        triggerRef={ref}
      />,
    );
    expect(screen.getByTestId('more-menu')).toBeInTheDocument();
  });

  it('isOpen=false일 때 메뉴를 숨긴다', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <ProfileDetailMoreMenu
        isOpen={false}
        onClose={vi.fn()}
        onOpenBlockConfirm={vi.fn()}
        onOpenReportSheet={vi.fn()}
        triggerRef={ref}
      />,
    );
    expect(screen.queryByTestId('more-menu')).not.toBeInTheDocument();
  });
});

describe('ProfileDetailDialogs', () => {
  it('차단 확인 시 onBlock과 onCloseSheet를 호출한다', () => {
    const onBlock = vi.fn();
    const onCloseSheet = vi.fn();
    render(
      <ProfileDetailDialogs
        profile={mockProfile}
        showBlockConfirm
        onCloseBlockConfirm={vi.fn()}
        showReportSheet={false}
        onCloseReportSheet={vi.fn()}
        onBlock={onBlock}
        onCloseSheet={onCloseSheet}
      />,
    );

    fireEvent.click(screen.getByTestId('confirm-dialog'));
    expect(onBlock).toHaveBeenCalledWith('user-1', '테스트유저');
    expect(onCloseSheet).toHaveBeenCalled();
  });

  it('신고 제출 시 onReport와 close 함수들을 호출한다', () => {
    const onReport = vi.fn();
    const onCloseReportSheet = vi.fn();
    const onCloseSheet = vi.fn();
    render(
      <ProfileDetailDialogs
        profile={mockProfile}
        showBlockConfirm={false}
        onCloseBlockConfirm={vi.fn()}
        showReportSheet
        onCloseReportSheet={onCloseReportSheet}
        onReport={onReport}
        onCloseSheet={onCloseSheet}
      />,
    );

    fireEvent.click(screen.getByTestId('report-sheet'));
    expect(onReport).toHaveBeenCalledWith('user-1', 'SPAM', null);
    expect(onCloseReportSheet).toHaveBeenCalled();
    expect(onCloseSheet).toHaveBeenCalled();
  });
});
