import type { DomainContextRequirementBase } from '../../platform/domain-context/domain-context.decorator.js';

export type ChatThreadMemberContextRequirement = DomainContextRequirementBase & {
  kind: 'chat-thread-member';
  mode: 'require-existing';
  param: 'threadId';
};
