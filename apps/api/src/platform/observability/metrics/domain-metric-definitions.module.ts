import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { DomainMetricDefinition } from './domain-metrics.port.js';
import { DomainMetricDefinitionRegistryService } from './domain-metric-definition-registry.service.js';
import { MetricsModule } from './metrics.module.js';

@Module({})
export class DomainMetricDefinitionsModule {
  static register(owner: string, definitions: readonly DomainMetricDefinition[]): DynamicModule {
    const registrationToken = Symbol(`DOMAIN_METRIC_DEFINITIONS:${owner}`);
    const registrationProvider: Provider = {
      provide: registrationToken,
      inject: [DomainMetricDefinitionRegistryService],
      useFactory: (registry: DomainMetricDefinitionRegistryService) => {
        registry.register(owner, definitions);
        return registrationToken;
      },
    };

    return {
      module: DomainMetricDefinitionsModule,
      imports: [MetricsModule],
      providers: [registrationProvider],
      exports: [MetricsModule],
    };
  }
}
