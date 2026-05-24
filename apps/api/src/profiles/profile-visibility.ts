import type {
  ProfileRelationToViewer,
  ProfileSource,
  PublicProfileActionCapabilities,
} from '@repo/shared/profile-contract';
import {
  resolvePublicExposure,
  type PublicExposureDecision,
  type PublicExposureTargetInput,
  type PublicExposureViewerInput,
} from '../season-participants/season-participant-policy.js';

export interface ProfileExposureResult {
  summaryVisible: true;
  detailViewable: boolean;
  canViewFull: boolean;
  scoreVisible: boolean;
  sourceProfile: ProfileSource;
  relationToViewer: ProfileRelationToViewer;
  actions: PublicProfileActionCapabilities;
}

export function resolveProfileExposure(input: {
  viewer: PublicExposureViewerInput;
  target: PublicExposureTargetInput;
}): ProfileExposureResult | null {
  const result: PublicExposureDecision = resolvePublicExposure(input.viewer, input.target);

  if (!result.summaryVisible) {
    return null;
  }

  return {
    summaryVisible: true,
    detailViewable: result.detailViewable,
    canViewFull: result.canViewFull,
    scoreVisible: result.scoreVisible,
    sourceProfile: result.sourceProfile,
    relationToViewer: result.relationToViewer,
    actions: result.actions,
  };
}
