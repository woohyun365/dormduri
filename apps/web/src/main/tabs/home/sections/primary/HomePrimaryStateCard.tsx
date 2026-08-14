'use client';

import { Fragment, useState } from 'react';
import { resolvePrimaryContent } from './model/primaryContent';
import { PrimaryWithdrawalSheet } from './PrimaryWithdrawalSheet';
import { OffSeasonPrimaryCard } from './states/OffSeasonPrimaryCard';
import { PostMatchPrimaryCard } from './states/PostMatchPrimaryCard';
import { SeasonMatchingPrimaryCard } from './states/SeasonMatchingPrimaryCard';
import { SeasonOpenPrimaryCard } from './states/SeasonOpenPrimaryCard';
import type { HomePrimaryStateCardProps, PrimaryContent } from './model/primaryTypes';

export function HomePrimaryStateCard({
  viewModel,
  seasonState,
  daysUntilEnd,
  onNavigate,
  onOpenBuildingSelect,
  onDeregisterSeasonParticipation,
}: HomePrimaryStateCardProps) {
  const [isWithdrawalSheetOpen, setWithdrawalSheetOpen] = useState(false);
  const content = resolvePrimaryContent({
    viewModel,
    seasonState,
    daysUntilEnd,
    onNavigate,
    onOpenBuildingSelect,
    onOpenWithdrawalSheet: () => setWithdrawalSheetOpen(true),
  });

  return (
    <Fragment>
      <PrimaryStateStrategy seasonState={seasonState} content={content} />
      {isWithdrawalSheetOpen && (
        <PrimaryWithdrawalSheet
          onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
          onClose={() => setWithdrawalSheetOpen(false)}
        />
      )}
    </Fragment>
  );
}

function PrimaryStateStrategy({
  seasonState,
  content,
}: Pick<HomePrimaryStateCardProps, 'seasonState'> & { content: PrimaryContent }) {
  if (seasonState === 'SEASON_OPEN') return <SeasonOpenPrimaryCard content={content} />;
  if (seasonState === 'SEASON_MATCHING') return <SeasonMatchingPrimaryCard content={content} />;
  if (seasonState === 'SEASON_POST_MATCH') return <PostMatchPrimaryCard content={content} />;

  return <OffSeasonPrimaryCard content={content} />;
}
