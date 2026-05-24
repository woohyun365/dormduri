import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user-contract';

const userDisplayIdentitySelect = {
  userId: true,
  nickname: true,
  nicknameNormalized: true,
  nicknameChangedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const userDismissedNoticeSelect = {
  noticeKey: true,
  dismissedAt: true,
} as const;

export function buildUserWithDisplayIdentitySelect() {
  return {
    id: true,
    email: true,
    emailVerifiedAt: true,
    deletedAt: true,
    gender: true,
    campus: true,
    displayIdentity: {
      select: userDisplayIdentitySelect,
    },
    dismissedNotices: {
      where: { noticeKey: SERVICE_INTRO_NOTICE_KEY },
      take: 1,
      select: userDismissedNoticeSelect,
    },
  } as const;
}

export interface UserDisplayIdentityRecord {
  userId: string;
  nickname: string;
  nicknameNormalized: string;
  nicknameChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDismissedNoticeRecord {
  noticeKey: string;
  dismissedAt: Date;
}

export interface UserWithDisplayIdentityQueryRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  displayIdentity: UserDisplayIdentityRecord | null;
  dismissedNotices: UserDismissedNoticeRecord[];
}

export interface UserWithDisplayIdentityRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  displayIdentity: UserDisplayIdentityRecord | null;
  dismissedNotices: UserDismissedNoticeRecord[];
}

export function mapUserWithDisplayIdentityProjection(
  user: UserWithDisplayIdentityQueryRecord,
): UserWithDisplayIdentityRecord {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    deletedAt: user.deletedAt,
    gender: user.gender,
    campus: user.campus,
    displayIdentity: user.displayIdentity,
    dismissedNotices: user.dismissedNotices,
  };
}
