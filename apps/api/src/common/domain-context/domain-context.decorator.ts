import { SetMetadata } from '@nestjs/common';

export const DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY = 'domain:context-requirements';

export type CurrentSeasonParticipantContextRequirement = {
  kind: 'current-season-participant';
  mode: 'ensure' | 'require-existing';
  source: 'actor-campus';
};

export type ChatThreadMemberContextRequirement = {
  kind: 'chat-thread-member';
  mode: 'require-existing';
  param: 'threadId';
};

export type ActiveMatchParticipantContextRequirement = {
  kind: 'active-match-participant';
  mode: 'require-existing';
  param: 'id';
};

export type DomainContextRequirement =
  | CurrentSeasonParticipantContextRequirement
  | ChatThreadMemberContextRequirement
  | ActiveMatchParticipantContextRequirement;

export function RequireDomainContext(...requirements: readonly DomainContextRequirement[]) {
  return SetMetadata(DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY, [...requirements]);
}
