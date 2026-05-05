import type {
  ProfileExposureLevel,
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
  exposureLevel: ProfileExposureLevel;
  sourceProfile: ProfileSource;
  relationToViewer: ProfileRelationToViewer;
  actions: PublicProfileActionCapabilities;
}

export function resolveProfileExposure(input: {
  viewer: PublicExposureViewerInput;
  target: PublicExposureTargetInput;
}): ProfileExposureResult | null {
  const result: PublicExposureDecision = resolvePublicExposure(input.viewer, input.target);

  if (result.exposureLevel === 'NONE') {
    return null;
  }

  return {
    exposureLevel: result.exposureLevel,
    sourceProfile: result.sourceProfile,
    relationToViewer: result.relationToViewer,
    actions: result.actions,
  };
}
