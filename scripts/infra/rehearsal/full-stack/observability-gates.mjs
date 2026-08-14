export async function waitForPrometheusTarget({ port, fetchImpl = fetch, sleep = defaultSleep }) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const url = new URL(`http://127.0.0.1:${port}/api/v1/query`);
    url.searchParams.set('query', 'up{job="api"}');
    const response = await fetchImpl(url);
    if (response.ok) {
      const payload = await response.json();
      const values = payload?.data?.result;
      if (Array.isArray(values) && values.some((entry) => entry.value?.[1] === '1')) return;
    }
    await sleep(1_500);
  }
  throw new Error('Prometheus API target did not become up.');
}

export async function waitForApiLogs({ port, fetchImpl = fetch, sleep = defaultSleep }) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const end = BigInt(Date.now()) * 1_000_000n;
    const start = end - 10n * 60n * 1_000_000_000n;
    const url = new URL(`http://127.0.0.1:${port}/loki/api/v1/query_range`);
    url.searchParams.set('query', '{service="api"}');
    url.searchParams.set('start', String(start));
    url.searchParams.set('end', String(end));
    url.searchParams.set('limit', '20');
    const response = await fetchImpl(url);
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload?.data?.result) && payload.data.result.length > 0) return;
    }
    await sleep(1_500);
  }
  throw new Error('API container logs did not arrive in Loki.');
}

export async function verifyObservabilityFailOpen({
  ports,
  webCompose,
  waitForHttp,
  recoveryMilliseconds,
  recordScenario,
}) {
  const apiUrl = `http://127.0.0.1:${ports.api}/health`;
  const webUrl = `http://127.0.0.1:${ports.web}/`;
  const components = [
    { service: 'alloy', ready: `http://127.0.0.1:${ports.alloy}/-/ready` },
    { service: 'loki', ready: `http://127.0.0.1:${ports.loki}/ready` },
    { service: 'prometheus', ready: `http://127.0.0.1:${ports.prometheus}/-/ready` },
    { service: 'grafana', ready: `http://127.0.0.1:${ports.grafana}/api/health` },
  ];

  for (const component of components) {
    webCompose('stop', component.service);
    await waitForHttp(apiUrl, `API during ${component.service} outage`, [200], 15_000);
    await waitForHttp(webUrl, `Web during ${component.service} outage`, [200], 15_000);
    const recoveryStartedAt = Date.now();
    webCompose('start', component.service);
    await waitForHttp(component.ready, `${component.service} recovery`, [200], 180_000);
    recoveryMilliseconds[component.service] = Date.now() - recoveryStartedAt;
    recordScenario(
      `observability-${component.service}-fail-open`,
      'pass',
      `recovered in ${recoveryMilliseconds[component.service]}ms`,
    );
  }
}

function defaultSleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
