import { Injectable } from '@nestjs/common';
import { assertDomainMetricLabelNames } from './metric-label.policy.js';
import type { DomainMetricDefinition, DomainMetricKind } from './domain-metrics.port.js';

const METRIC_NAME_PATTERN = /^api_[a-z0-9_]+$/u;

interface RegisteredDomainMetricDefinition {
  readonly owner: string;
  readonly definition: DomainMetricDefinition;
}

@Injectable()
export class DomainMetricDefinitionRegistryService {
  private readonly definitions = new Map<string, RegisteredDomainMetricDefinition>();

  register(owner: string, definitions: readonly DomainMetricDefinition[]): void {
    const normalizedOwner = owner.trim();
    if (!normalizedOwner) {
      throw new Error('Domain metric definition owner is required.');
    }

    for (const definition of definitions) {
      this.validateDefinition(definition);
      const existing = this.definitions.get(definition.name);
      if (existing) {
        throw new Error(
          `Duplicate domain metric definition: ${definition.name} (${existing.owner}, ${normalizedOwner})`,
        );
      }
      this.definitions.set(definition.name, {
        owner: normalizedOwner,
        definition: Object.freeze({
          ...definition,
          labelNames: Object.freeze([...definition.labelNames]),
          buckets: definition.buckets ? Object.freeze([...definition.buckets]) : undefined,
        }),
      });
    }
  }

  require(name: string, kind: DomainMetricKind): DomainMetricDefinition {
    const registered = this.definitions.get(name);
    if (!registered || registered.definition.kind !== kind) {
      throw new Error(`Unsupported ${kind} domain metric: ${name}`);
    }
    return registered.definition;
  }

  list(): readonly RegisteredDomainMetricDefinition[] {
    return [...this.definitions.values()];
  }

  private validateDefinition(definition: DomainMetricDefinition): void {
    if (!METRIC_NAME_PATTERN.test(definition.name)) {
      throw new Error(`Invalid domain metric name: ${definition.name}`);
    }
    if (!definition.help.trim()) {
      throw new Error(`Domain metric help is required: ${definition.name}`);
    }
    assertDomainMetricLabelNames(definition.labelNames);

    if (definition.kind !== 'histogram' && definition.buckets !== undefined) {
      throw new Error(`Only histogram metrics may define buckets: ${definition.name}`);
    }
    if (definition.buckets && !isStrictlyIncreasing(definition.buckets)) {
      throw new Error(
        `Histogram buckets must be finite and strictly increasing: ${definition.name}`,
      );
    }
  }
}

function isStrictlyIncreasing(values: readonly number[]): boolean {
  return values.every(
    (value, index) =>
      Number.isFinite(value) && value >= 0 && (index === 0 || value > values[index - 1]!),
  );
}
