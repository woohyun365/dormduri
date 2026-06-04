import 'reflect-metadata';
import {
  DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
  isDomainContextRequirement,
  RequireDomainContext,
  type DomainContextRequirementBase,
} from './domain-context.decorator.js';

describe('platform domain-context metadata primitive', () => {
  it('stores arbitrary domain requirement metadata without owning domain vocabulary', () => {
    class Controller {
      @RequireDomainContext({ kind: 'test-domain-context', mode: 'require-existing' })
      handler(this: void) {
        return null;
      }
    }

    const metadata = Reflect.getMetadata(
      DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
      Controller.prototype.handler,
    ) as DomainContextRequirementBase[];

    expect(metadata).toEqual([{ kind: 'test-domain-context', mode: 'require-existing' }]);
    const [requirement] = metadata;

    expect(requirement).toBeDefined();
    expect(isDomainContextRequirement(requirement!, 'test-domain-context')).toBe(true);
    expect(isDomainContextRequirement(requirement!, 'other-context')).toBe(false);
  });
});
