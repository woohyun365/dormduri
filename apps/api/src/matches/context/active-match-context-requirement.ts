import type { DomainContextRequirementBase } from '../../platform/domain-context/domain-context.decorator.js';

export type ActiveMatchParticipantContextRequirement = DomainContextRequirementBase & {
  kind: 'active-match-participant';
  mode: 'require-existing';
  param: 'id';
  failure: 'unmatch-request-not-allowed' | 'unmatch-cancel-not-allowed';
};
