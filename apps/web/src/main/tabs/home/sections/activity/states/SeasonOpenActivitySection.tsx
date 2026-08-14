'use client';

import { useState } from 'react';
import { StaticActivityCard } from '../StaticActivityCard';
import { OperatedDormitoryListModal } from '../dialogs/OperatedDormitoryListModal';
import { SeasonOpenActionModal } from '../dialogs/SeasonOpenActionModal';
import { resolveSeasonOpenActivityContent } from '../model/activityContent';
import type { TabId, MatchingNavOptions } from '@/main/model/navigation';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type { SeasonOpenModalKind } from '../model/activityTypes';

interface SeasonOpenActivitySectionProps {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onDeregisterSeasonParticipation?: () => Promise<void>;
}

export function SeasonOpenActivitySection({
  viewModel,
  onNavigate,
  onDeregisterSeasonParticipation,
}: SeasonOpenActivitySectionProps) {
  const [isOperatedDormitoryListOpen, setOperatedDormitoryListOpen] = useState(false);
  const [seasonOpenModal, setSeasonOpenModal] = useState<SeasonOpenModalKind | null>(null);
  const seasonOpenActivity = resolveSeasonOpenActivityContent({
    viewModel,
    onNavigate,
    onOpenOperatedDormitoryList: () => setOperatedDormitoryListOpen(true),
    onOpenSeasonOpenModal: setSeasonOpenModal,
  });

  return (
    <>
      <StaticActivityCard {...seasonOpenActivity} />
      <OperatedDormitoryListModal
        isOpen={isOperatedDormitoryListOpen}
        viewModel={viewModel}
        onClose={() => setOperatedDormitoryListOpen(false)}
      />
      <SeasonOpenActionModal
        kind={seasonOpenModal}
        viewModel={viewModel}
        onNavigate={onNavigate}
        onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
        onClose={() => setSeasonOpenModal(null)}
      />
    </>
  );
}
