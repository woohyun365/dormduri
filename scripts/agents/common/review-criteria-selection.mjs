#!/usr/bin/env node
// Picks the review criteria documents for a set of changed paths. The repository binding document
// owns the path globs (`repo-structure.*`); a pack sublayer section names its path keys under
// `### binding 키`, which ties them to that sublayer's criteria document `web-<pack>-<sublayer>`.
// The layerless documents (swe, documents, agent-workflow-tooling) take `repo-structure.review-<id>`.
// Between layers (fe, bff, be, db, infra) only the document with the more specific matching key
// stays; inside a layer, cross-cutting and layerless documents every match stays. A selected
// document also selects the documents its header names ("이 문서를 고르면 … 함께 고릅니다").
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverContextPack } from './domain-guide-registry.mjs';
import { buildTaskEnvelope } from './intake-policy.mjs';

export const REVIEW_CRITERIA_SELECTION_SCHEMA = 'review-criteria-selection/v1';
export const REVIEW_CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
export const REVIEW_BINDING_PATH = 'docs/development/agent-workflows/domain/knu-binding.md';
export const REVIEW_PACK_DIR = 'docs/development/agent-workflows/domain/swe-web';
const LAYERLESS = ['swe', 'documents', 'agent-workflow-tooling'];
const CROSS_CUTTING = new Set(['security-privacy', 'operations-release']);
// Registry domains that signal each pack layer. The signal is recorded, never required (a binding
// path key without it is still chosen, and the miss is input for aligning the registry).
const LAYER_SIGNALS = {
  fe: ['frontend'],
  bff: ['bff'],
  be: ['backend'],
  db: ['backend'],
  infra: ['infrastructure'],
  'security-privacy': ['auth', 'legal-policy'],
  'operations-release': ['operations', 'migration'],
};
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const fail = (message) => {
  throw new TypeError(message);
};

// Path globs inside backticks only; text outside them never narrows the range. A trailing `/` is
// everything under it, `<name>` one segment, a leading `!` an exclusion. A backticked word that is
// not a path (no `/` or `*` and no file extension, such as an example feature name) is prose.
export function bindingPathGlobs(value) {
  const include = [];
  const exclude = [];
  for (const [, raw] of String(value).matchAll(/`([^`]+)`/gu)) {
    const negated = raw.startsWith('!');
    let glob = negated ? raw.slice(1) : raw;
    if (!/[/*]/u.test(glob) && !/^[^/]*\.[A-Za-z0-9]+$/u.test(glob)) continue;
    glob = glob.replace(/<[^<>/]+>/gu, '*');
    if (glob.endsWith('/')) glob = `${glob}**`;
    (negated ? exclude : include).push(glob);
  }
  return { include, exclude };
}

const segmentPattern = (segment) =>
  new RegExp(
    `^${segment
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, '\\$&'))
      .join('[^/]*')}$`,
    'u',
  );
// `**` is zero or more segments, but a trailing one at least one (everything under a directory, as
// OSS-DOM coverage-check reads it); `*` inside a segment is any characters but `/`; nothing is
// special about a leading dot.
export function matchPathGlob(path, glob) {
  const parts = path.split('/');
  const globs = glob.split('/');
  const walk = (p, g) => {
    if (g === globs.length) return p === parts.length;
    if (globs[g] === '**' && g === globs.length - 1) return p < parts.length;
    if (globs[g] === '**') {
      for (let next = p; next <= parts.length; next += 1) if (walk(next, g + 1)) return true;
      return false;
    }
    return p < parts.length && segmentPattern(globs[g]).test(parts[p]) && walk(p + 1, g + 1);
  };
  return walk(0, 0);
}
// The fixed segments before the first wildcard segment.
export function pathGlobSpecificity(glob) {
  const segments = glob.split('/');
  const at = segments.findIndex((segment) => segment.includes('*'));
  return at === -1 ? segments.length : at;
}

function readText(root, path) {
  const full = join(root, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}
function bindingKeys(text) {
  const keys = {};
  for (const line of text.split('\n')) {
    const row = /^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*$/u.exec(line);
    if (!row || !row[1].startsWith('repo-structure.')) continue;
    const globs = bindingPathGlobs(row[2]);
    if (!globs.include.length) fail(`binding-path-glob-missing: ${row[1]}`);
    keys[row[1]] = globs;
  }
  return keys;
}
// `## <sublayer>` sections of one pack file and the `repo-structure.*` keys in their binding list.
function packSections(text) {
  const sections = [];
  let current = null;
  let inBinding = false;
  for (const line of text.split('\n')) {
    const h2 = /^## (\S.*?)\s*$/u.exec(line);
    if (h2) {
      current = { name: h2[1], keys: [] };
      sections.push(current);
      inBinding = false;
      continue;
    }
    if (/^### /u.test(line)) inBinding = current !== null && /^### binding 키\s*$/u.test(line);
    if (!inBinding) continue;
    for (const [, key] of line.matchAll(/\{\{binding:(repo-structure\.[a-z0-9-]+)\}\}/gu))
      if (!current.keys.includes(key)) current.keys.push(key);
  }
  return sections;
}
function criteriaDocument(root, id) {
  const path = `${REVIEW_CRITERIA_DIR}/${id}.md`;
  const text = readText(root, path);
  if (text === null) return null;
  const items = [...text.matchAll(/^### ([A-Z]+[0-9]+)\. /gmu)].map(
    ([, item]) => `${id}.md ${item}`,
  );
  const header = /이 문서를 고르면([\s\S]*?)함께 고릅니다/u.exec(text)?.[1] ?? '';
  const inherits = [
    ...new Set([...header.matchAll(/\]\(\.\/([a-z0-9-]+)\.md(?:#[^)]*)?\)/gu)].map(([, x]) => x)),
  ];
  return { id, path, items, inherits };
}

// Loads the binding keys, the pack sections and the criteria documents. A sublayer section without
// a path key, a key missing from the binding table and a section or link without its criteria
// document are refused. Without a binding document nothing is selected automatically; the criteria
// documents stay available to an explicit choice.
export function loadReviewCriteriaCatalog(
  root = process.cwd(),
  { packDir = REVIEW_PACK_DIR } = {},
) {
  root = resolve(root);
  const catalog = { root, keys: {}, documents: {}, criteriaIds: [] };
  const criteriaDir = join(root, REVIEW_CRITERIA_DIR);
  if (existsSync(criteriaDir))
    catalog.criteriaIds = readdirSync(criteriaDir)
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .map((name) => name.slice(0, -3))
      .filter((id) => ID.test(id))
      .sort();
  const binding = readText(root, REVIEW_BINDING_PATH);
  if (binding !== null) catalog.keys = bindingKeys(binding);
  const add = (id, layer, keys, source) => {
    const document = criteriaDocument(root, id);
    if (document === null)
      fail(`criteria-document-missing: ${REVIEW_CRITERIA_DIR}/${id}.md (${source})`);
    for (const key of keys)
      if (!catalog.keys[key]) fail(`binding-key-unresolved: ${key} (${source})`);
    catalog.documents[id] = { ...document, layer, keys };
  };
  const packs =
    binding !== null && existsSync(join(root, packDir))
      ? readdirSync(join(root, packDir))
          .filter((name) => name.endsWith('.md') && name !== 'README.md')
          .sort()
      : [];
  for (const file of packs) {
    const layer = file.slice(0, -3);
    for (const section of packSections(readFileSync(join(root, packDir, file), 'utf8'))) {
      const source = `${packDir}/${file} ${section.name}`;
      if (!section.keys.length) fail(`criteria-path-key-missing: ${source}`);
      add(`web-${layer}-${section.name}`, layer, section.keys, source);
    }
  }
  for (const id of LAYERLESS) {
    const key = `repo-structure.review-${id}`;
    if (catalog.keys[key]) add(id, null, [key], key);
  }
  // Documents reached only through a header link or an explicit --criteria.
  for (const id of catalog.criteriaIds)
    if (!catalog.documents[id])
      catalog.documents[id] = { ...criteriaDocument(root, id), layer: null, keys: [] };
  for (const document of Object.values(catalog.documents))
    for (const target of document.inherits)
      if (!catalog.documents[target])
        fail(`criteria-document-missing: ${REVIEW_CRITERIA_DIR}/${target}.md (${document.path})`);
  return catalog;
}

const layered = (document) => document.layer !== null && !CROSS_CUTTING.has(document.layer);
// The area judgment of one path: each document whose path key matches, after the overlap rule.
// Exported for the area-criteria check, which reads `areas` (the pack layers of those documents).
export function matchReviewCriteriaPath(path, catalog) {
  const matches = [];
  for (const document of Object.values(catalog.documents)) {
    let best = null;
    for (const key of document.keys) {
      const { include, exclude } = catalog.keys[key];
      if (exclude.some((glob) => matchPathGlob(path, glob))) continue;
      for (const glob of include) {
        if (!matchPathGlob(path, glob)) continue;
        const specificity = pathGlobSpecificity(glob);
        if (best === null || specificity > best.specificity) best = { key, glob, specificity };
      }
    }
    if (best) matches.push({ id: document.id, layer: document.layer, ...best });
  }
  const suppressed = [];
  const kept = matches.filter((match) => {
    if (!layered(match)) return true;
    const stronger = matches
      .filter(
        (other) =>
          layered(other) && other.layer !== match.layer && other.specificity > match.specificity,
      )
      .sort((a, b) => b.specificity - a.specificity || a.id.localeCompare(b.id))[0];
    if (stronger)
      suppressed.push({
        id: match.id,
        path,
        by: stronger.id,
        specificity: match.specificity,
        bySpecificity: stronger.specificity,
      });
    return !stronger;
  });
  kept.sort((a, b) => a.id.localeCompare(b.id));
  suppressed.sort((a, b) => a.id.localeCompare(b.id));
  return {
    path,
    matches: kept,
    suppressed,
    documents: kept.map((match) => match.id),
    areas: [...new Set(kept.map((match) => match.layer).filter((layer) => layer !== null))].sort(),
  };
}

let neutralEnvelope = null;
// The registry's domains for one changed path, from its own path rules only.
function registryDomains(path) {
  try {
    neutralEnvelope ??= buildTaskEnvelope({ request: '리뷰 대상 경로의 기준 문서를 고른다.' });
    const pack = discoverContextPack({
      envelope: neutralEnvelope,
      repositoryEvidence: [{ path, kind: 'changed-file' }],
    });
    return new Set(
      pack.domainCandidates
        .filter((candidate) => candidate.evidence.includes(`changed-file: ${path}`))
        .map((candidate) => candidate.domain),
    );
  } catch {
    return new Set();
  }
}
const countOf = (documents) => ({
  documentCount: documents.length,
  itemCount: documents.reduce((total, document) => total + document.items.length, 0),
});
function validCriteria(criteria, catalog) {
  if (!Array.isArray(criteria) || !criteria.length)
    fail('criteria-invalid: a non-empty list of criteria document ids is required');
  if (new Set(criteria).size !== criteria.length) fail('criteria-invalid: duplicate id');
  for (const id of criteria)
    if (typeof id !== 'string' || !ID.test(id) || !catalog.criteriaIds.includes(id))
      fail(`criteria-invalid: no ${REVIEW_CRITERIA_DIR}/${id}.md`);
  return criteria;
}
const pick = (document, reasons) => ({
  id: document.id,
  path: document.path,
  layer: document.layer,
  items: document.items,
  reasons,
});

// The selection record of one review: chosen documents with their item ids and reasons, documents
// left out by the overlap rule, counts and the paths no path key matched. Given criteria override
// the automatic choice, which the record keeps under `automatic`.
export function selectReviewCriteria({ paths, catalog, criteria } = {}) {
  if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || !path))
    fail('criteria-paths-invalid: a list of repository paths is required');
  const unique = [...new Set(paths.map((path) => path.replace(/^\.\//u, '')))];
  const reasons = new Map();
  const suppressed = [];
  const unmatchedPaths = [];
  for (const path of unique) {
    const judged = matchReviewCriteriaPath(path, catalog);
    suppressed.push(...judged.suppressed);
    if (!judged.matches.length && !judged.suppressed.length) unmatchedPaths.push(path);
    let domains = null;
    for (const match of judged.matches) {
      const reason = {
        rule: 'path-key',
        path,
        key: match.key,
        glob: match.glob,
        specificity: match.specificity,
      };
      if (match.layer !== null) {
        domains ??= registryDomains(path);
        const signals = LAYER_SIGNALS[match.layer];
        reason.layerSignal = !signals
          ? 'unknown'
          : signals.some((domain) => domains.has(domain))
            ? 'present'
            : 'missing';
      }
      if (!reasons.has(match.id)) reasons.set(match.id, { direct: [], inherited: [] });
      reasons.get(match.id).direct.push(reason);
    }
  }
  const queue = [...reasons.keys()];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const target of catalog.documents[id].inherits) {
      if (!reasons.has(target)) reasons.set(target, { direct: [], inherited: [] });
      const entry = reasons.get(target);
      if (!entry.inherited.some((reason) => reason.from === id))
        entry.inherited.push({ rule: 'inherited', from: id });
      queue.push(target);
    }
  }
  const automatic = [...reasons.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) =>
      pick(catalog.documents[id], [
        ...entry.direct,
        ...entry.inherited.sort((a, b) => a.from.localeCompare(b.from)),
      ]),
    );
  const base = {
    schema: REVIEW_CRITERIA_SELECTION_SCHEMA,
    paths: unique,
    suppressed,
    unmatchedPaths,
  };
  if (criteria === undefined)
    return { ...base, override: false, documents: automatic, ...countOf(automatic) };
  const given = validCriteria(criteria, catalog).map((id) =>
    pick(catalog.documents[id], [{ rule: 'override' }]),
  );
  return {
    ...base,
    override: true,
    requested: [...criteria],
    documents: given,
    ...countOf(given),
    automatic: { documents: automatic.map((document) => document.id), ...countOf(automatic) },
  };
}

function main(argv) {
  let root = process.cwd();
  let criteria;
  const paths = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--') {
      paths.push(...argv.slice(i + 1));
      break;
    }
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--criteria') criteria = String(argv[++i] ?? '').split(',');
    else paths.push(argv[i]);
  }
  if (!paths.length || typeof root !== 'string') {
    process.stderr.write(
      'usage: review-criteria-selection.mjs [--root <dir>] [--criteria <id,...>] -- <path>...\n',
    );
    return 2;
  }
  try {
    const record = selectReviewCriteria({
      paths,
      catalog: loadReviewCriteriaCatalog(root),
      criteria,
    });
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = main(process.argv.slice(2));
