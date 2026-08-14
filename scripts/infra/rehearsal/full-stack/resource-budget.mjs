export function verifyResourceBudget({
  apiConfig,
  webConfig,
  databaseMode,
  productEnvelopeMiB,
  localDatabaseAllowanceMiB,
  expectedProductContainerLimitMiB,
  engineMemoryMiB,
  assert,
  recordScenario,
}) {
  const productLimitMiB =
    serviceMemoryLimitMiB(apiConfig, 'api', assert) +
    serviceMemoryLimitMiB(apiConfig, 'nginx', assert) +
    ['web', 'prometheus', 'loki', 'alloy', 'alertmanager', 'grafana'].reduce(
      (sum, service) => sum + serviceMemoryLimitMiB(webConfig, service, assert),
      0,
    );
  const databaseLimitMiB =
    databaseMode === 'local' ? serviceMemoryLimitMiB(apiConfig, 'postgres', assert) : 0;

  assert(
    productLimitMiB === expectedProductContainerLimitMiB,
    `Product container limit must total ${expectedProductContainerLimitMiB}MiB; received ${productLimitMiB}MiB.`,
  );
  assert(
    productLimitMiB <= productEnvelopeMiB,
    `Product container limits exceed the ${productEnvelopeMiB}MiB envelope.`,
  );
  assert(
    databaseLimitMiB === (databaseMode === 'local' ? localDatabaseAllowanceMiB : 0),
    `Database allowance mismatch: ${databaseLimitMiB}MiB.`,
  );
  assert(!webConfig.services?.['web-upstream'], 'Full-stack profile includes the Web fixture.');

  const engineHeadroomMiB = engineMemoryMiB - productLimitMiB - databaseLimitMiB;
  recordScenario(
    'product-resource-budget',
    'pass',
    `${productLimitMiB}MiB product limits; ${databaseLimitMiB}MiB RDS-like local allowance; ${engineHeadroomMiB}MiB engine headroom`,
  );
  recordScenario('full-stack-fixture-exclusion', 'pass', 'web-upstream is not composed');

  return { productLimitMiB, databaseLimitMiB, engineHeadroomMiB };
}

function serviceMemoryLimitMiB(config, serviceName, assert) {
  const raw = config.services?.[serviceName]?.deploy?.resources?.limits?.memory;
  assert(raw !== undefined, `${serviceName} memory limit is missing.`);
  return Number(raw) / 1024 / 1024;
}
