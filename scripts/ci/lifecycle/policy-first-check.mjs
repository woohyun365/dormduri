// Policy-first checks of the Lifecycle gate. Pure functions over the context run.mjs builds: the parsed
// `Lifecycle` section, the PR diff, and file reads at the head, base and merge-base revisions. Every check returns
// findings `{ check, level: 'fail' | 'warn' | 'pass', reason }`; run.mjs applies override lines and the bot·main
// downgrade. Authoring rules: docs/development/github/collaboration.md (`Lifecycle` 절); rule ids, citation form and
// the path table: docs/policies/README.md.

import { POLICY_GRADES } from './lifecycle-section.mjs';

export const POLICY_FIRST_CHECK_IDS = ['W-SCOPE', 'W-POLICY', 'W-CITE', 'W-IRREV', 'L-CONFIRM'];
export const PATH_DOMAINS_FILE = 'docs/policies/path-domains.json';
export const ARTIFACT_MAP_FILE = 'docs/product/artifact-map.json';
export const POLICY_README_FILE = 'docs/policies/README.md';
const CONFIRMED_FILES = [PATH_DOMAINS_FILE, ARTIFACT_MAP_FILE];
const POLICY_DOCUMENT = /^docs\/policies\/([a-z0-9-]+)\.md$/u;
const OWNER_CONFIRMED = 'owner-confirmed';

export const policyPath = (name) => `docs/policies/${name}.md`;

// An input the gate cannot read or parse. run.mjs fails the job closed on it.
export class LifecycleInputError extends Error {}

// Globs use `**` (any depth) and `*` (one path segment) only.
export function globToRegExp(glob) {
  const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/gu, '\\$&');
  const segment = (part) =>
    part
      .split('**')
      .map((piece) => piece.split('*').map(escape).join('[^/]*'))
      .join('.*');
  return new RegExp(`^${glob.split('**/').map(segment).join('(?:.*/)?')}$`, 'u');
}

const sortedUnique = (values) => [...new Set(values)].sort();
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function schemaReader(file) {
  const fail = (detail) => {
    throw new LifecycleInputError(`${file} 형식 오류: ${detail}`);
  };
  const object = (value, where, required, optional = []) => {
    if (!isObject(value)) fail(`${where}: 객체가 아님`);
    const unknown = Object.keys(value).filter((key) => ![...required, ...optional].includes(key));
    if (unknown.length) fail(`${where}: 모르는 key ${unknown.join(', ')}`);
    const missing = required.filter((key) => !(key in value));
    if (missing.length) fail(`${where}: ${missing.join(', ')} 없음`);
  };
  const strings = (value, where, pattern = /\S/u, { empty = false } = {}) => {
    if (!Array.isArray(value) || (!empty && value.length === 0))
      fail(`${where}: 비어 있지 않은 배열이 아님`);
    for (const item of value)
      if (typeof item !== 'string' || !pattern.test(item))
        fail(`${where}: 값 ${JSON.stringify(item)}`);
  };
  const string = (value, where, pattern = /\S/u) => {
    if (typeof value !== 'string' || !pattern.test(value))
      fail(`${where}: 값 ${JSON.stringify(value)}`);
  };
  const confirmedBy = (value) => {
    object(value, 'confirmedBy', ['status', 'date', 'basis']);
    if (!['draft', OWNER_CONFIRMED].includes(value.status))
      fail(`confirmedBy.status: 값 ${value.status}`);
    if (value.date !== null) string(value.date, 'confirmedBy.date', /^\d{4}-\d{2}-\d{2}$/u);
    if (value.basis !== null) string(value.basis, 'confirmedBy.basis', /^#[1-9]\d*$/u);
    if (value.status === OWNER_CONFIRMED && (value.date === null || value.basis === null))
      fail('confirmedBy: owner-confirmed에 date·basis 없음');
  };
  const parse = (text) => {
    try {
      return JSON.parse(text);
    } catch (error) {
      return fail(error.message);
    }
  };
  return { fail, object, strings, string, confirmedBy, parse };
}

const GLOB = /^(?!\/)[^\s?[\]{}!\\]+$/u;
const DOMAIN = /^[a-z0-9-]+$/u;

export function parsePathDomains(text) {
  const schema = schemaReader(PATH_DOMAINS_FILE);
  const value = schema.parse(text);
  // Top-level keys are checked one by one so the first missing field names itself.
  schema.object(
    value,
    '최상위',
    [],
    ['schema', 'confirmedBy', 'productRoots', 'entries', 'noDomain', 'irreversiblePaths'],
  );
  if (value.schema !== 'lifecycle-path-domains/v1') schema.fail(`schema: 값 ${value.schema}`);
  schema.confirmedBy(value.confirmedBy);
  schema.strings(value.productRoots, 'productRoots', GLOB);
  if (!Array.isArray(value.entries)) schema.fail('entries: 배열이 아님');
  value.entries.forEach((entry, index) => {
    schema.object(entry, `entries[${index}]`, ['globs', 'domains'], ['except']);
    schema.strings(entry.globs, `entries[${index}].globs`, GLOB);
    if ('except' in entry) schema.strings(entry.except, `entries[${index}].except`, GLOB);
    schema.strings(entry.domains, `entries[${index}].domains`, DOMAIN);
  });
  if (!Array.isArray(value.noDomain)) schema.fail('noDomain: 배열이 아님');
  value.noDomain.forEach((entry, index) => {
    schema.object(entry, `noDomain[${index}]`, ['globs', 'reason']);
    schema.strings(entry.globs, `noDomain[${index}].globs`, GLOB);
    schema.string(entry.reason, `noDomain[${index}].reason`);
  });
  if (!Array.isArray(value.irreversiblePaths)) schema.fail('irreversiblePaths: 배열이 아님');
  value.irreversiblePaths.forEach((entry, index) => {
    schema.object(entry, `irreversiblePaths[${index}]`, ['glob', 'policy', 'reason']);
    schema.string(entry.glob, `irreversiblePaths[${index}].glob`, GLOB);
    schema.string(entry.policy, `irreversiblePaths[${index}].policy`, POLICY_DOCUMENT);
    schema.string(entry.reason, `irreversiblePaths[${index}].reason`);
  });
  return value;
}

const MAPPINGS = ['doc', 'composite', 'legacy', 'not-applicable'];
const LEVELS = ['cross-cutting', 'cross-cutting-recommended', 'domain'];

export function parseArtifactMap(text) {
  const schema = schemaReader(ARTIFACT_MAP_FILE);
  const value = schema.parse(text);
  schema.object(value, '최상위', [], ['schema', 'confirmedBy', 'artifacts']);
  if (value.schema !== 'lifecycle-artifact-map/v1') schema.fail(`schema: 값 ${value.schema}`);
  schema.confirmedBy(value.confirmedBy);
  if (!Array.isArray(value.artifacts)) schema.fail('artifacts: 배열이 아님');
  const seen = new Set();
  value.artifacts.forEach((artifact, index) => {
    const where = `artifacts[${index}]`;
    schema.object(artifact, where, ['artifact', 'mapping'], ['level', 'sources', 'gaps', 'note']);
    schema.string(artifact.artifact, `${where}.artifact`);
    if (seen.has(artifact.artifact)) schema.fail(`${where}.artifact: 중복 ${artifact.artifact}`);
    seen.add(artifact.artifact);
    if (!MAPPINGS.includes(artifact.mapping))
      schema.fail(`${where}.mapping: 값 ${artifact.mapping}`);
    if ('level' in artifact && !LEVELS.includes(artifact.level))
      schema.fail(`${where}.level: 값 ${artifact.level}`);
    if ('sources' in artifact) schema.strings(artifact.sources, `${where}.sources`);
    if ('gaps' in artifact) schema.strings(artifact.gaps, `${where}.gaps`);
    if ('note' in artifact) schema.string(artifact.note, `${where}.note`);
  });
  return value;
}

// Path → policy domain table. A path takes the union of every row it matches (minus the row's `except` globs).
export function createPathTable(pathDomains) {
  const compile = (globs) => globs.map(globToRegExp);
  const matches = (patterns, path) => patterns.some((pattern) => pattern.test(path));
  const productRoots = compile(pathDomains.productRoots);
  const entries = pathDomains.entries.map((entry) => ({
    globs: compile(entry.globs),
    except: compile(entry.except ?? []),
    domains: entry.domains,
  }));
  const noDomain = compile(pathDomains.noDomain.flatMap((entry) => entry.globs));
  const irreversible = pathDomains.irreversiblePaths.map((entry) => ({
    ...entry,
    pattern: globToRegExp(entry.glob),
  }));
  return {
    isProductPath: (path) => matches(productRoots, path),
    domainsOf: (path) =>
      sortedUnique(
        entries
          .filter((entry) => matches(entry.globs, path) && !matches(entry.except, path))
          .flatMap((entry) => entry.domains),
      ),
    isNoDomain: (path) => matches(noDomain, path),
    irreversibleEntry: (path) => irreversible.find((entry) => entry.pattern.test(path)) ?? null,
    globs: () => [
      ...pathDomains.entries.flatMap((entry) => [...entry.globs, ...(entry.except ?? [])]),
      ...pathDomains.noDomain.flatMap((entry) => entry.globs),
      ...pathDomains.irreversiblePaths.map((entry) => entry.glob),
    ],
  };
}

// Rule id prefixes from the policy README table: the column headed `규칙 id 접두어`, keyed by the linked document.
export function policyPrefixes(readme) {
  const prefixes = new Map();
  let column = -1;
  for (const line of (readme ?? '').split('\n')) {
    if (!line.startsWith('|')) {
      column = -1;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.includes('규칙 id 접두어')) {
      column = cells.indexOf('규칙 id 접두어');
      continue;
    }
    const document = /^\[([a-z0-9-]+)\.md\]\(\.\/\1\.md\)$/u.exec(cells[0] ?? '')?.[1];
    const prefix = (cells[column] ?? '').replace(/`/gu, '');
    if (column >= 0 && document && /^[A-Z]{2,3}$/u.test(prefix)) prefixes.set(document, prefix);
  }
  return prefixes;
}

// Document status header: consecutive `**key**: value` lines right under the title; `**상태**` is the status.
export function headerStatus(text) {
  const lines = text.split('\n');
  let index = lines.findIndex((line) => line.startsWith('# '));
  if (index < 0) return null;
  for (index += 1; index < lines.length && !lines[index].trim(); index += 1);
  for (; index < lines.length && /^\*\*[^*]+\*\*:/u.test(lines[index]); index += 1) {
    const status = /^\*\*상태\*\*:\s*(.+)$/u.exec(lines[index]);
    if (status) return status[1].trim();
  }
  return null;
}

function confirmedByAt(context, revision, file) {
  const text = context.readFile(revision, file);
  if (text === null) return null;
  try {
    return JSON.parse(text).confirmedBy ?? null;
  } catch {
    return null;
  }
}

const sameConfirmation = (left, right) =>
  left !== null &&
  right !== null &&
  ['status', 'date', 'basis'].every((key) => left[key] === right[key]);

export function evaluatePolicyFirst(context) {
  const { section, grade, changedPaths, pathTable, revisions } = context;
  const featureClass = POLICY_GRADES.includes(grade);
  const groundLevel = featureClass ? 'fail' : 'warn';
  const findings = [];
  const add = (check, level, reason) => findings.push({ check, level, reason });
  const notComputed = (check, reason) => add(check, 'pass', `${reason}은 계산하지 않음`);
  const readHead = (path) => context.readFile(revisions.head, path);

  const productPaths = changedPaths.filter(pathTable.isProductPath);
  const judged = sortedUnique(productPaths.flatMap(pathTable.domainsOf));
  const declared = sortedUnique(section.domains ?? []);
  const considered = sortedUnique([...judged, ...declared]);

  // W-SCOPE: every domain the path table judged from the diff is declared.
  if (grade === 'trivial') notComputed('W-SCOPE', 'trivial');
  else {
    const missing = judged.filter((domain) => !declared.includes(domain));
    const extra = declared.filter((domain) => !judged.includes(domain));
    if (missing.length)
      add('W-SCOPE', groundLevel, `판정 도메인이 선언에 없음: ${missing.join(', ')}`);
    if (extra.length) add('W-SCOPE', 'warn', `선언이 판정보다 많음: ${extra.join(', ')}`);
    if (!missing.length && !extra.length)
      add(
        'W-SCOPE',
        'pass',
        judged.length ? `판정 도메인 선언됨: ${judged.join(', ')}` : '판정 도메인 없음',
      );
  }

  // W-POLICY: each judged or declared domain's policy has an owner-confirmed basis (header, else the tracking record).
  if (grade === 'trivial') notComputed('W-POLICY', 'trivial');
  else {
    const missingBasis = considered.flatMap((domain) => {
      const text = readHead(policyPath(domain));
      if (text === null) return [`${domain}(정책 문서 없음)`];
      const status = headerStatus(text);
      if (status !== null)
        return status === OWNER_CONFIRMED ? [] : [`${domain}(header 상태 ${status})`];
      if (!context.artifactMap) return [`${domain}(대응 기록 없음)`];
      if (
        !context.artifactMap.artifacts.some((artifact) => artifact.artifact === `policy:${domain}`)
      )
        return [`${domain}(대응 기록 항목 없음)`];
      const recordStatus = context.artifactMap.confirmedBy.status;
      return recordStatus === OWNER_CONFIRMED ? [] : [`${domain}(대응 기록 확인 ${recordStatus})`];
    });
    for (const reason of missingBasis)
      add('W-POLICY', groundLevel, `owner-confirmed 근거 없음: ${reason}`);
    if (!missingBasis.length)
      add(
        'W-POLICY',
        'pass',
        considered.length
          ? `owner-confirmed 근거 있음: ${considered.join(', ')}`
          : '판정·선언한 도메인 없음',
      );
  }

  // W-CITE: each judged or declared domain has a rule id citation or a no-impact line; cited ids exist with the prefix.
  if (grade === 'trivial') notComputed('W-CITE', 'trivial');
  else {
    const before = findings.length;
    const cited = new Set(section.citations.map((citation) => citation.document));
    const noImpact = new Set(section.noImpact.map((line) => line.domain));
    for (const domain of considered)
      if (!cited.has(domain) && !noImpact.has(domain))
        add('W-CITE', groundLevel, `인용도 정책 영향 없음 줄도 없음: ${domain}`);
    const prefixes = section.citations.length
      ? policyPrefixes(readHead(POLICY_README_FILE))
      : new Map();
    for (const { document, id } of section.citations) {
      const prefix = prefixes.get(document);
      const label = `${document}.md ${id}`;
      if (!prefix) add('W-CITE', groundLevel, `정책 README 표에 접두어가 없음: ${label}`);
      else if (id.slice(0, id.indexOf('-R')) !== prefix)
        add('W-CITE', groundLevel, `접두어가 정책 README 표와 다름: ${label}(표 ${prefix})`);
      if (!(readHead(policyPath(document)) ?? '').includes(`**${id}**`))
        add('W-CITE', groundLevel, `인용한 id가 문서에 없음: ${label}`);
    }
    if (findings.length === before)
      add(
        'W-CITE',
        'pass',
        considered.length
          ? `인용 또는 정책 영향 없음 줄 있음: ${considered.join(', ')}`
          : '판정·선언한 도메인 없음',
      );
  }

  // W-IRREV: grades below feature·policy-change may not change an irreversible path.
  if (featureClass) notComputed('W-IRREV', 'feature·정책 변경');
  else {
    const hits = changedPaths
      .map((path) => [path, pathTable.irreversibleEntry(path)])
      .filter(([, entry]) => entry);
    for (const [path, entry] of hits)
      add('W-IRREV', 'fail', `비가역 경로 변경: ${path}(${entry.policy})`);
    if (!hits.length) add('W-IRREV', 'pass', '비가역 경로 변경 없음');
  }

  // L-CONFIRM: the path table and tracking record carry this PR's Owner confirmation; feature-class policy changes
  // carry an Owner line. Overrides do not lower these fails (run.mjs nonOverridable).
  const confirmations = section.ownerConfirmations;
  const changedConfirmed = CONFIRMED_FILES.filter((file) => changedPaths.includes(file));
  for (const file of changedConfirmed) {
    const problems = [];
    const lines = confirmations.filter((line) => line.path === file);
    const current = confirmedByAt(context, revisions.head, file);
    if (!lines.length) problems.push(`Owner 확인 줄 없음: ${file}`);
    if (current === null) problems.push(`confirmedBy 없음: ${file}`);
    else if (current.status !== OWNER_CONFIRMED)
      problems.push(`confirmedBy가 owner-confirmed가 아님: ${file} (${current.status})`);
    else {
      if (lines.length && !lines.some((line) => line.date === current.date))
        problems.push(
          `Owner 확인 줄 날짜와 confirmedBy.date가 다름: ${file} 줄 ${lines.map((line) => line.date).join(', ')}, 파일 ${current.date}`,
        );
      if (!context.issueRefs.includes(Number(String(current.basis).slice(1))))
        problems.push(`confirmedBy.basis가 본문이 참조하는 issue가 아님: ${file} ${current.basis}`);
      if (sameConfirmation(confirmedByAt(context, revisions.mergeBase, file), current))
        problems.push(`이 PR이 confirmedBy를 바꾸지 않음: ${file}(merge-base와 같음)`);
    }
    for (const reason of problems) add('L-CONFIRM', 'fail', reason);
    if (!problems.length) add('L-CONFIRM', 'pass', `Owner 확인 대조 통과: ${file}`);
  }
  // POLICY_DOCUMENT is lower-case, so the README is not a policy document change.
  const policyChanges = changedPaths.filter((path) => POLICY_DOCUMENT.test(path));
  for (const path of policyChanges) {
    if (!featureClass)
      add('L-CONFIRM', 'warn', `trivial·bugfix·hotfix가 정책 문서를 바꿈(등급 상향 후보): ${path}`);
    else if (!confirmations.some((line) => line.path === path))
      add('L-CONFIRM', 'fail', `정책 문서 Owner 확인 줄 없음: ${path}`);
    else add('L-CONFIRM', 'pass', `정책 문서 Owner 확인 줄 있음: ${path}`);
  }
  if (!changedConfirmed.length && !policyChanges.length)
    add('L-CONFIRM', 'pass', '경로 표·대응 기록·정책 문서 변경 없음');

  // Path warnings: unclassified product paths in the diff and globs that match no tracked file at head.
  for (const path of productPaths)
    if (!pathTable.domainsOf(path).length && !pathTable.isNoDomain(path))
      add('(경로)', 'warn', `미분류 제품 경로: ${path}`);
  const patterns = new Map(pathTable.globs().map((glob) => [glob, globToRegExp(glob)]));
  for (const [glob, pattern] of patterns)
    if (!context.headFiles.some((path) => pattern.test(path)))
      add('(경로)', 'warn', `추적 파일에 맞지 않는 glob: ${glob}`);

  return findings;
}
