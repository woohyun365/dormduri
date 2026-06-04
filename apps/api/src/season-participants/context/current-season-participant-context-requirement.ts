import type { DomainContextRequirementBase } from '../../platform/domain-context/domain-context.decorator.js';

export type CurrentSeasonParticipantContextRequirement = DomainContextRequirementBase & {
  kind: 'current-season-participant';
  mode: 'ensure' | 'require-existing';
  source: 'actor-campus';
  failure: 'context-required' | 'season-profile-draft-not-allowed' | 'registration-not-allowed';
};
