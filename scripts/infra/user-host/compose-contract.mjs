// Web 단계 host compose(infra/deploy/user/compose.yml)의 구조 계약. `docker compose config --format json` 결과를 받아
// 어긋난 점의 목록을 돌려준다(빈 목록 = 통과). validate-compose가 실제 파일에, test가 fixture에 쓴다.
// 기준: web publish 없음, read-only root·tmpfs·non-root image·no-new-privileges, memory는 infrastructure-target
// readiness의 시작값(nginx 96MiB·Web 320MiB), json-file 10MB × 3.
export const USER_HOST_MEMORY_LIMITS = Object.freeze({
  web: 320 * 1024 * 1024,
  ingress: 96 * 1024 * 1024,
});
// 운영 compose는 배포 document가 넣는 registry digest 참조를 받는다. local render·smoke는 같은 형식의 placeholder를 쓴다.
export const USER_HOST_RENDER_ENVIRONMENT = Object.freeze({
  WEB_IMAGE: `dormduri/web@sha256:${'0'.repeat(64)}`,
  INGRESS_IMAGE: `dormduri/ingress@sha256:${'0'.repeat(64)}`,
  WEB_RELEASE: 'web-000000000000',
});
export const INGRESS_PUBLISHED_PORTS = Object.freeze(['80:8080', '443:8443']);
export const INGRESS_READ_ONLY_MOUNTS = Object.freeze([
  '/etc/dormduri-tls',
  '/run/dormduri-mode',
  '/var/www/acme',
]);

function hardeningProblems(name, service) {
  const problems = [];
  if (service.read_only !== true) problems.push(`${name}: root filesystem is not read-only`);
  if (JSON.stringify(service.cap_drop ?? []) !== '["ALL"]')
    problems.push(`${name}: capabilities are not all dropped`);
  if (service.cap_add?.length) problems.push(`${name}: adds capabilities`);
  if (!(service.security_opt ?? []).includes('no-new-privileges:true')) {
    problems.push(`${name}: no-new-privileges is not set`);
  }
  if (service.privileged) problems.push(`${name}: runs privileged`);
  if (service.network_mode || service.pid || service.ipc)
    problems.push(`${name}: shares a host namespace`);
  if (service.user !== undefined && /^(?:0|root)(?::|$)/u.test(String(service.user))) {
    problems.push(`${name}: overrides the image user with root`);
  }
  if (!(service.tmpfs ?? []).some((entry) => entry.startsWith('/tmp:')))
    problems.push(`${name}: /tmp is not a tmpfs`);
  if (Number(service.deploy?.resources?.limits?.memory) !== USER_HOST_MEMORY_LIMITS[name]) {
    problems.push(`${name}: memory limit differs from the infrastructure-target start value`);
  }
  if (!Number.isInteger(service.deploy?.resources?.limits?.pids))
    problems.push(`${name}: no pids limit`);
  if (service.restart !== 'unless-stopped')
    problems.push(`${name}: restart policy is not unless-stopped`);
  const logging = service.logging ?? {};
  if (
    logging.driver !== 'json-file' ||
    logging.options?.['max-size'] !== '10m' ||
    logging.options?.['max-file'] !== '3'
  ) {
    problems.push(`${name}: log rotation differs from json-file 10m x 3`);
  }
  if (JSON.stringify(Object.keys(service.networks ?? {})) !== '["web"]')
    problems.push(`${name}: not only on the web network`);
  for (const volume of service.volumes ?? []) {
    if (/docker\.sock/u.test(volume.source ?? ''))
      problems.push(`${name}: mounts the Docker socket`);
  }
  return problems;
}

export function checkUserHostCompose(config) {
  const services = config.services ?? {};
  const problems = [];
  if (JSON.stringify(Object.keys(services).sort()) !== '["ingress","web"]') {
    problems.push(
      `services must be exactly ingress and web, got ${Object.keys(services).join(', ')}`,
    );
    return problems;
  }
  const { web, ingress } = services;
  problems.push(...hardeningProblems('web', web), ...hardeningProblems('ingress', ingress));
  if (web.ports?.length) problems.push('web: publishes a host port');
  if (web.volumes?.length) problems.push('web: mounts a host path');
  const environment = web.environment ?? {};
  if (environment.API_URL !== 'http://ingress:8081')
    problems.push('web: API_URL is not the private ingress listener');
  if (!/^https:\/\//u.test(environment.WEB_APP_URL ?? ''))
    problems.push('web: WEB_APP_URL is not https');
  if (environment.NODE_ENV !== 'production') problems.push('web: NODE_ENV is not production');
  const published = (ingress.ports ?? []).map((port) => `${port.published}:${port.target}`).sort();
  if (JSON.stringify(published) !== JSON.stringify([...INGRESS_PUBLISHED_PORTS].sort())) {
    problems.push(`ingress: published ports ${published.join(', ')} differ from 80 and 443`);
  }
  const mounts = (ingress.volumes ?? []).map((volume) => volume.target).sort();
  if (JSON.stringify(mounts) !== JSON.stringify([...INGRESS_READ_ONLY_MOUNTS])) {
    problems.push(
      `ingress: mounts ${mounts.join(', ')} differ from the TLS, mode and ACME directories`,
    );
  }
  for (const volume of ingress.volumes ?? []) {
    if (volume.read_only !== true) problems.push(`ingress: ${volume.target} is writable`);
  }
  if (
    !ingress.healthcheck?.test?.some?.((part) => String(part).includes(':8081/__ingress/health'))
  ) {
    problems.push('ingress: healthcheck does not probe the private health location');
  }
  return problems;
}

// Local rehearsal이 운영 render에서 바꿔도 되는 곳: project·network 이름, local build(image 출처), ingress의 loopback
// publish port와 host 경로 source. 그 밖(env, hardening, mount target·read_only, service 구성)이 다르면 rehearsal은 운영
// 구성을 시험하지 못한다.
const REHEARSAL_DIFFERENCES = [
  /^\.name$/u,
  /^\.networks\.[^.]+\.name$/u,
  /^\.services\.[^.]+\.(?:build|image)(?:\.|\[|$)/u,
  /^\.services\.ingress\.ports\[\d+\]\.(?:host_ip|published)$/u,
  /^\.services\.ingress\.volumes\[\d+\]\.source$/u,
];

function differences(left, right, path, out) {
  if (Array.isArray(left) && Array.isArray(right) && left.length === right.length) {
    left.forEach((item, index) => differences(item, right[index], `${path}[${index}]`, out));
  } else if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      differences(left[key], right[key], `${path}.${key}`, out);
    }
  } else if (JSON.stringify(left) !== JSON.stringify(right)) out.push(path);
  return out;
}

export function rehearsalDifferenceProblems(production, rehearsal) {
  const problems = differences(production, rehearsal, '', [])
    .filter((path) => !REHEARSAL_DIFFERENCES.some((pattern) => pattern.test(path)))
    .map((path) => `rehearsal differs from the host compose at ${path}`);
  for (const port of rehearsal.services?.ingress?.ports ?? []) {
    if (port.host_ip !== '127.0.0.1')
      problems.push(`rehearsal publishes ingress ${port.target} beyond loopback`);
  }
  return problems;
}
