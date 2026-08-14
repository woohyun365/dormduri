import { describe, expect, it } from 'vitest';
import { DomainMetricDefinitionRegistryService } from './domain-metric-definition-registry.service.js';

describe('DomainMetricDefinitionRegistryService', () => {
  it('registers immutable owner-local definitions', () => {
    const registry = new DomainMetricDefinitionRegistryService();
    registry.register('auth', [
      {
        name: 'api_auth_test_total',
        kind: 'counter',
        help: 'Auth test metric.',
        labelNames: ['outcome'],
      },
    ]);

    expect(registry.require('api_auth_test_total', 'counter')).toEqual({
      name: 'api_auth_test_total',
      kind: 'counter',
      help: 'Auth test metric.',
      labelNames: ['outcome'],
      buckets: undefined,
    });
    expect(registry.list()).toHaveLength(1);
  });

  it('fails fast on duplicate names and unsafe labels', () => {
    const registry = new DomainMetricDefinitionRegistryService();
    const definition = {
      name: 'api_test_total',
      kind: 'counter' as const,
      help: 'Test metric.',
      labelNames: ['outcome'] as const,
    };
    registry.register('first', [definition]);

    expect(() => registry.register('second', [definition])).toThrow(
      'Duplicate domain metric definition',
    );
    expect(() =>
      new DomainMetricDefinitionRegistryService().register('unsafe', [
        { ...definition, name: 'api_unsafe_total', labelNames: ['userId'] as never },
      ]),
    ).toThrow();
  });

  it('rejects invalid histogram buckets and counter buckets', () => {
    const registry = new DomainMetricDefinitionRegistryService();

    expect(() =>
      registry.register('invalid', [
        {
          name: 'api_invalid_duration_seconds',
          kind: 'histogram',
          help: 'Invalid histogram.',
          labelNames: [],
          buckets: [0.1, 0.1],
        },
      ]),
    ).toThrow('strictly increasing');
    expect(() =>
      registry.register('invalid', [
        {
          name: 'api_invalid_total',
          kind: 'counter',
          help: 'Invalid counter.',
          labelNames: [],
          buckets: [1],
        },
      ]),
    ).toThrow('Only histogram metrics');
  });
});
