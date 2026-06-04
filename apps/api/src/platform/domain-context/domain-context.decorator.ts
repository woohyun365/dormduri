import { SetMetadata } from '@nestjs/common';

export const DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY = 'domain:context-requirements';

export type DomainContextRequirementBase = {
  kind: string;
};

export function RequireDomainContext<TRequirement extends DomainContextRequirementBase>(
  ...requirements: readonly TRequirement[]
) {
  return SetMetadata(DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY, [...requirements]);
}

export function isDomainContextRequirement<TRequirement extends DomainContextRequirementBase>(
  requirement: DomainContextRequirementBase,
  kind: TRequirement['kind'],
): requirement is TRequirement {
  return requirement.kind === kind;
}
