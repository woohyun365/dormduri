#!/usr/bin/env node
// Reviewer context inputs: the records a reviewer reads beside the subject to judge it against what was
// intended, decided and required. From the review target paths it lists the product intent
// (`docs/product/intent.md`, when present), the decision record of each layer the automatic criteria
// selection picks (`docs/architecture/decisions/<layer>.md`, when present), the policy document of each
// policy domain the Lifecycle gate judges for the product paths (its path table functions are imported,
// not copied) and the change-grade draft the Parent gives. Every input carries its reason. The binding
// document is not an input, and no host policy is imported.
// Rules: docs/development/agent-workflows/review-criteria/README.md (리뷰어 입력)
//
// Usage: node scripts/agents/common/review-context-inputs.mjs [--root <dir>] [--lifecycle-draft <path>]
//          -- <path>...
// Exit 0 = the record on stdout, 1 = an input it cannot read (criteria catalog, path table, draft),
// 2 = usage error.
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadReviewCriteriaCatalog, selectReviewCriteria } from './review-criteria-selection.mjs';
import {
  PATH_DOMAINS_FILE,
  createPathTable,
  parsePathDomains,
  policyPath,
} from '../../ci/lifecycle/policy-first-check.mjs';

export const REVIEW_CONTEXT_INPUTS_SCHEMA = 'review-context-inputs/v1';
export const INTENT_PATH = 'docs/product/intent.md';
export const DECISIONS_DIR = 'docs/architecture/decisions';
const LIFECYCLE_HEADING = /^## Lifecycle[ \t]*$/mu;

const fail = (message) => {
  throw new TypeError(message);
};
const isFile = (root, path) => {
  try {
    return lstatSync(join(root, path)).isFile();
  } catch {
    return false;
  }
};
const sorted = (values) => [...new Set(values)].sort();

// A draft path relative to the root that names a regular file with a `## Lifecycle` section.
function lifecycleDraftPath(root, draft) {
  if (typeof draft !== 'string' || !draft.trim() || isAbsolute(draft))
    fail(`lifecycle-draft-invalid: ${JSON.stringify(draft)} is not a repository-relative path`);
  const path = relative(root, resolve(root, normalize(draft)));
  if (!path || path.startsWith('..'))
    fail(`lifecycle-draft-invalid: ${draft} is outside the repository`);
  if (!isFile(root, path)) fail(`lifecycle-draft-invalid: ${draft} is not a readable file`);
  if (!LIFECYCLE_HEADING.test(readFileSync(join(root, path), 'utf8')))
    fail(`lifecycle-draft-invalid: ${draft} has no "## Lifecycle" section`);
  return path;
}

// Layer → the target paths and criteria documents that brought it in, from the automatic selection.
function selectedLayers(root, paths) {
  const { documents } = selectReviewCriteria({ paths, catalog: loadReviewCriteriaCatalog(root) });
  const layers = new Map();
  for (const document of documents.filter(({ layer }) => layer !== null)) {
    if (!layers.has(document.layer)) layers.set(document.layer, { documents: [], paths: [] });
    const entry = layers.get(document.layer);
    entry.documents.push(document.id);
    entry.paths.push(
      ...document.reasons.filter((reason) => reason.rule === 'path-key').map(({ path }) => path),
    );
  }
  return layers;
}

// Domain → the product paths the gate's path table judged into it; none without a path table.
function judgedDomains(root, paths) {
  const domains = new Map();
  if (!existsSync(join(root, PATH_DOMAINS_FILE))) return domains;
  const table = createPathTable(
    parsePathDomains(readFileSync(join(root, PATH_DOMAINS_FILE), 'utf8')),
  );
  for (const path of paths.filter(table.isProductPath))
    for (const domain of table.domainsOf(path)) {
      if (!domains.has(domain)) domains.set(domain, []);
      domains.get(domain).push(path);
    }
  return domains;
}

// The input record of one review: intent, decision records by layer, policy documents by domain, then
// the draft. Layer and domain inputs whose file is missing are kept under `absent`, not as read paths. A
// subject without changed paths (a read-only task) still takes the intent and the draft.
export function reviewContextInputs({ root = process.cwd(), paths, lifecycleDraft } = {}) {
  if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || !path))
    fail('context-paths-invalid: a list of repository paths is required');
  root = realpathSync(root);
  const unique = [...new Set(paths.map((path) => path.replace(/^\.\//u, '')))];
  const draft = lifecycleDraft === undefined ? null : lifecycleDraftPath(root, lifecycleDraft);
  const inputs = [];
  const absent = [];
  if (isFile(root, INTENT_PATH))
    inputs.push({ kind: 'intent', path: INTENT_PATH, reason: { rule: 'intent' } });
  const layers = selectedLayers(root, unique);
  for (const layer of sorted(layers.keys())) {
    const path = `${DECISIONS_DIR}/${layer}.md`;
    if (!isFile(root, path)) {
      absent.push({ kind: 'decision', path, layer });
      continue;
    }
    const { documents, paths: matched } = layers.get(layer);
    inputs.push({
      kind: 'decision',
      path,
      reason: { rule: 'layer', layer, documents: sorted(documents), paths: sorted(matched) },
    });
  }
  const domains = judgedDomains(root, unique);
  for (const domain of sorted(domains.keys())) {
    const path = policyPath(domain);
    if (!isFile(root, path)) {
      absent.push({ kind: 'policy', path, domain });
      continue;
    }
    inputs.push({
      kind: 'policy',
      path,
      reason: { rule: 'policy-domain', domain, paths: sorted(domains.get(domain)) },
    });
  }
  if (draft !== null)
    inputs.push({ kind: 'lifecycle-draft', path: draft, reason: { rule: 'lifecycle-draft' } });
  return { schema: REVIEW_CONTEXT_INPUTS_SCHEMA, paths: unique, inputs, absent };
}

// The short reason a reviewer input line shows beside each path.
export function contextInputLabel(input) {
  if (input.kind === 'intent') return 'product intent';
  if (input.kind === 'decision') return `decision record, layer ${input.reason.layer}`;
  if (input.kind === 'policy') return `policy, domain ${input.reason.domain}`;
  if (input.kind === 'lifecycle-draft') return 'Parent change-grade draft';
  return fail(`context-input-invalid: ${input.kind}`);
}

function main(argv) {
  let root = process.cwd();
  let lifecycleDraft;
  const paths = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--') {
      paths.push(...argv.slice(i + 1));
      break;
    }
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--lifecycle-draft') lifecycleDraft = argv[++i];
    else paths.push(argv[i]);
  }
  if (!paths.length || typeof root !== 'string') {
    process.stderr.write(
      'usage: review-context-inputs.mjs [--root <dir>] [--lifecycle-draft <path>] -- <path>...\n',
    );
    return 2;
  }
  try {
    const record = reviewContextInputs({ root, paths, lifecycleDraft });
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = main(process.argv.slice(2));
