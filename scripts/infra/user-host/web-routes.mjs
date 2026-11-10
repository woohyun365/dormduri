// Web 단계 ingress가 Web route(apps/web/src/app)와 맞는지 보는 데 쓰는 route 목록.
// - opened: Web 단계에서 Web으로 보내는 page(infra/deploy/README.md 'User host 묶음'의 경로 표).
// - comingSoon: 뒤 단계에서 열 page의 첫 경로 조각. ingress는 이 조각 아래 전부를 '준비 중' 503 화면으로 끝낸다.
// - jsonComingSoon: BFF(`api`) 조각. 브라우저 fetch가 읽으므로 같은 503을 화면 대신 JSON으로 끝낸다(공개 API 주소 없음).
// - metadata: Next.js metadata 파일 규칙으로 app 루트에서 만들어지는 경로. 모르는 metadata 파일은 오류로 알려 허용
//   목록을 다시 정하게 한다.
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const WEB_APP_DIRECTORY = 'apps/web/src/app';
// Next.js가 URL 루트로 내보내는 정적 파일. 여기에 파일이 생기면 ingress 허용 목록에도 들어가야 한다(아니면 404).
export const WEB_PUBLIC_DIRECTORY = 'apps/web/public';
export const OPENED_PAGES = Object.freeze(['/', '/privacy', '/terms']);
export const BFF_SEGMENT = 'api';
const ROUTE_FILE = /^(?:page|route)\.(?:tsx?|jsx?|mdx?)$/u;
// app 루트의 metadata 파일 → 내보내는 경로. Next.js file convention(robots·sitemap·icon) 가운데 지금 쓰는 것만 둔다.
const METADATA_FILES = [
  { pattern: /^robots\.(?:ts|js|txt)$/u, path: () => '/robots.txt' },
  { pattern: /^sitemap\.(?:ts|js|xml)$/u, path: () => '/sitemap.xml' },
  { pattern: /^icon\.(png|ico|jpg|jpeg|svg)$/u, path: (match) => `/icon.${match[1]}` },
];
const METADATA_CONVENTION =
  /^(?:robots|sitemap|manifest|favicon|icon\d*|apple-icon\d*|opengraph-image\d*|twitter-image\d*)\./u;

function hasRouteFile(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (hasRouteFile(path)) return true;
    } else if (ROUTE_FILE.test(entry)) {
      return true;
    }
  }
  return false;
}

export function readWebRoutes(repoRoot) {
  const appDirectory = resolve(repoRoot, WEB_APP_DIRECTORY);
  const segments = [];
  const metadata = [];
  const unknownMetadata = [];
  for (const entry of readdirSync(appDirectory).sort()) {
    const path = join(appDirectory, entry);
    if (statSync(path).isDirectory()) {
      // Private folder `_x`(예: `__tests__`)는 routing에서 빠진다. Route group `(x)`·parallel route `@x`는 그 아래 page의
      // URL이 달라지는데 지금 저장소에는 없으므로, 만나면 이 목록 계산을 다시 정하게 한다.
      if (entry.startsWith('_')) continue;
      if (/^[(@]/u.test(entry)) throw new Error(`unsupported app directory convention: ${entry}`);
      if (hasRouteFile(path)) segments.push(entry);
      continue;
    }
    const known = METADATA_FILES.find(({ pattern }) => pattern.test(entry));
    if (known) metadata.push(known.path(known.pattern.exec(entry)));
    else if (METADATA_CONVENTION.test(entry)) unknownMetadata.push(entry);
  }
  return {
    segments,
    metadata: metadata.sort(),
    unknownMetadata,
    publicFiles: readPublicFiles(resolve(repoRoot, WEB_PUBLIC_DIRECTORY)),
  };
}

// `.gitkeep` 같은 dotfile은 내보내지 않는 자리 표시라 뺀다.
function readPublicFiles(directory, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory).sort()) {
    if (entry.startsWith('.')) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...readPublicFiles(path, `${prefix}/${entry}`));
    else files.push(`${prefix}/${entry}`);
  }
  return files;
}

export function expectedIngressRoutes(routes) {
  const opened = new Set(OPENED_PAGES.map((page) => page.slice(1)).filter(Boolean));
  return {
    exact: [...OPENED_PAGES, '/_next/image', ...routes.metadata, ...routes.publicFiles].sort(),
    prefix: ['/_next/static/'],
    comingSoon: routes.segments
      .filter((segment) => !opened.has(segment) && segment !== BFF_SEGMENT)
      .sort(),
    jsonComingSoon: routes.segments.filter((segment) => segment === BFF_SEGMENT),
  };
}
