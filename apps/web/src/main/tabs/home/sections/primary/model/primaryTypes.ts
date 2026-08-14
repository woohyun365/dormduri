import type { ElementType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { MatchingNavOptions, TabId } from '@/main/model/navigation';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';

export interface HomePrimaryStateCardProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  daysUntilEnd: number;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
  onDeregisterSeasonParticipation?: () => Promise<void>;
}

export type PrimaryTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'purple'
  | 'cyan'
  | 'red'
  | 'openRequired'
  | 'openPrep'
  | 'slate';

export interface PrimaryAction {
  label: string;
  icon: ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'warning';
}

export interface PrimaryInsight {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
  tone?:
    | 'neutral'
    | 'participant'
    | 'buildingOpen'
    | 'buildingLocked'
    | 'matchSuccess'
    | 'matchedResult';
  helper?: string;
  todayNewCount?: number;
  onClick?: () => void;
}

export interface PrimaryDateRow {
  label: string;
  value: string;
  strongValue?: string;
  badge?: string;
  pill?: string;
  tone?: PrimaryDeadlineTone;
  hideValueOnNarrow?: boolean;
  hidePillOnNarrow?: boolean;
  hideBadgeOnNarrow?: boolean;
}

export interface PrimaryProgress {
  label: string;
  value: string;
  percent: number;
  tone?: PrimaryDeadlineTone;
}

export type PrimaryDeadlineTone = 'normal' | 'warning' | 'critical' | 'closed';

export interface PrimarySuccessHighlight {
  count: number;
  text: string;
  urgency: 'normal' | 'warning' | 'critical';
}

export type PrimaryTaskStepStatus = 'complete' | 'actionable' | 'locked' | 'blocked';

export interface PrimaryTaskStep {
  id: 'profile' | 'dormitory' | 'registration';
  label: string;
  status: PrimaryTaskStepStatus;
  statusLabel?: string;
  helper?: string;
}

export interface PrimaryNotice {
  tone: 'info' | 'warning' | 'success';
  text: string;
}

export interface PrimaryPolicyHint {
  label: string;
  text: string;
  icon: LucideIcon;
  iconClassName: string;
}

export type SeasonOpenPolicyHintContext =
  | 'profile-and-dormitory-required'
  | 'dormitory-required'
  | 'profile-required'
  | 'registration-ready'
  | 'registered-summary';

export interface PrimaryContent {
  eyebrow: string;
  title: string;
  body?: string;
  icon: ElementType;
  tone: PrimaryTone;
  action?: PrimaryAction;
  secondaryAction?: PrimaryAction;
  steps?: PrimaryTaskStep[];
  notice?: PrimaryNotice;
  insights?: PrimaryInsight[];
  insightTitle?: string;
  insightSubtitle?: string;
  dateSectionTitle?: string;
  dateRows?: PrimaryDateRow[];
  progress?: PrimaryProgress;
  successHighlight?: PrimarySuccessHighlight;
  meta?: string;
  helper?: string;
  policyHints?: PrimaryPolicyHint[];
  policyHintAriaLabel?: string;
}

export type ResolvePrimaryContentParams = Omit<
  HomePrimaryStateCardProps,
  'onDeregisterSeasonParticipation'
> & {
  onOpenWithdrawalSheet?: () => void;
};
