import type { ElementType } from 'react';
import type { TabId, MatchingNavOptions } from '@/main/model/navigation';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';

export interface HomeActivityPanelProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onDeregisterSeasonParticipation?: () => Promise<void>;
  onRequestActiveMatchUnmatch?: (activeMatchId: string) => Promise<void>;
  onCancelActiveMatchUnmatchRequest?: (activeMatchId: string) => Promise<void>;
}

export interface StaticActivityAction {
  label: string;
  onClick: () => void;
  icon?: ElementType;
  trailingIcon?: boolean;
  emphasis?: 'primary' | 'secondary';
  buttonTone?: StaticActivityTone;
}

export type StaticActivityTone =
  | 'default'
  | 'openRequired'
  | 'openReady'
  | 'openRegistered'
  | 'openWaiting'
  | 'postMatch'
  | 'postMatchMatched';

export type SeasonOpenModalKind =
  | 'profile-composition'
  | 'registration-confirmation'
  | 'withdrawal-policy'
  | 'profile-view';

export interface StaticActivityMetric {
  label: string;
  value: string;
  helper: string;
  icon: ElementType;
  tone?: 'neutral' | 'participant' | 'buildingOpen' | 'buildingLocked' | 'matchSuccess' | 'result';
  todayNewCount?: number;
  onClick?: () => void;
}

export type PostMatchActivityOutcome =
  | 'not-registered'
  | 'deregistered'
  | 'matched'
  | 'unmatched-after-success'
  | 'not-matched'
  | 'history';

export type PostMatchDetailModalKind = 'activity' | 'profile';
export type OffSeasonDetailModalKind = 'activity' | 'profile';
