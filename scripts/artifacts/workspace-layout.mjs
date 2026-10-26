// Workspace layout manifest: the core default (logical roots, consumer paths, retention vocabulary) and the KNU
// binding (current root names, KNU-only roots, tools kinds, guard inputs). Field meanings:
// docs/development/agent-workflows/workspace-layout.md
//
// Nothing here reads a file at module load. Hook handlers import modules that import this one, so a missing or
// broken manifest may only fail a caller that asks for a value.
import { readFileSync } from 'node:fs';

export const WORKSPACE_LAYOUT_CORE_SCHEMA = 'htc-workspace-layout-core/v1';
export const WORKSPACE_LAYOUT_BINDING_SCHEMA = 'htc-workspace-layout-binding/v1';

const CORE_URL = new URL('./workspace-layout.core.json', import.meta.url);
const BINDING_URL = new URL('./workspace-layout.knu.json', import.meta.url);

const TRACKING = ['tracked', 'ignored'];
const COPY = ['allowed', 'forbidden', 'unspecified'];
const CHILD_RULES = ['markdown-only', 'declared-plan-id', 'tool-kinds'];
const CORE_KEYS = ['schema', 'guide', 'retentionClasses', 'retentionUntil', 'creators', 'roots'];
const CORE_ROOT_KEYS = [
  'id',
  'path',
  'kind',
  'purpose',
  'tracking',
  'trackedFiles',
  'creator',
  'children',
  'retention',
  'copy',
];
const BINDING_KEYS = [
  'schema',
  'core',
  'guide',
  'roots',
  'toolKinds',
  'archive',
  'retiredRoots',
  'guardExclusions',
  'rootLiteralTransitionPlan',
  'rootLiteralAllowlist',
];
const BINDING_ROOT_KEYS = [
  ...CORE_ROOT_KEYS,
  'core',
  'ruleOwner',
  'trackedFilesOwner',
  'marker',
  'archive',
  'reviewInput',
  'nestedState',
  'overridable',
];
const ALLOWLIST_KEYS = ['file', 'text', 'count', 'category', 'transition'];
const ALLOWLIST_CATEGORIES = [
  'paths-default',
  'host-constant',
  'review-input-roots',
  'classifier-workspace',
  'codex-context',
  'path-check',
  'message',
];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isTextList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);
// Repository-relative POSIX path: no leading slash, no `.`/`..` segment, no backslash or trailing slash.
const isRelativePath = (value) =>
  isText(value) &&
  !value.startsWith('/') &&
  !value.endsWith('/') &&
  !value.includes('\\') &&
  value.split('/').every((segment) => segment && segment !== '.' && segment !== '..');

function unknownKeys(errors, where, value, keys) {
  for (const key of Object.keys(value))
    if (!keys.includes(key)) errors.push(`${where}: unknown field ${key}`);
}

function checkRetention(errors, where, retention, core) {
  if (!isObject(retention)) return errors.push(`${where}: retention must be an object`);
  unknownKeys(errors, where, retention, ['class', 'until']);
  if (!core.retentionClasses.includes(retention.class))
    errors.push(`${where}: retention class ${retention.class} is not in the vocabulary`);
  if ('until' in retention && !core.retentionUntil.includes(retention.until))
    errors.push(`${where}: retention until ${retention.until} is not in the vocabulary`);
}

function checkRoots(errors, label, roots, core, keys) {
  if (!Array.isArray(roots) || roots.length === 0)
    return errors.push(`${label}: roots must be a list`);
  const ids = new Set();
  const paths = new Set();
  for (const [index, root] of roots.entries()) {
    const where = `${label} root ${root?.id ?? index}`;
    if (!isObject(root)) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    unknownKeys(errors, where, root, keys);
    for (const key of ['id', 'purpose'])
      if (!isText(root[key])) errors.push(`${where}: ${key} is required`);
    if (ids.has(root.id)) errors.push(`${where}: duplicate id`);
    ids.add(root.id);
    if (!isRelativePath(root.path)) errors.push(`${where}: path must be repository-relative`);
    if (paths.has(root.path)) errors.push(`${where}: duplicate path ${root.path}`);
    paths.add(root.path);
    if (!['directory', 'file'].includes(root.kind))
      errors.push(`${where}: kind must be directory or file`);
    if (!TRACKING.includes(root.tracking))
      errors.push(`${where}: tracking must be tracked or ignored`);
    if (!COPY.includes(root.copy)) errors.push(`${where}: copy must be one of ${COPY.join(', ')}`);
    if (
      !isTextList(root.creator) ||
      !root.creator.every((creator) => core.creators.includes(creator))
    )
      errors.push(`${where}: creator must list known creators`);
    if (
      'trackedFiles' in root &&
      !(isTextList(root.trackedFiles) && root.trackedFiles.every(isRelativePath))
    )
      errors.push(`${where}: trackedFiles must list relative paths`);
    if (
      'children' in root &&
      !CHILD_RULES.includes(root.children) &&
      !(
        isObject(root.children) &&
        Object.keys(root.children).join() === 'names' &&
        isTextList(root.children.names)
      )
    )
      errors.push(`${where}: children must be a known rule or { names }`);
    // Git history keeps tracked roots; an ignored root carries a retention class unless its children do.
    if (root.tracking === 'tracked' && 'retention' in root)
      errors.push(`${where}: a tracked root carries no retention`);
    if ('retention' in root) checkRetention(errors, where, root.retention, core);
  }
  for (const root of roots)
    if (
      isObject(root) &&
      root.tracking === 'ignored' &&
      !('retention' in root) &&
      root.children !== 'tool-kinds' &&
      !roots.some((other) => other !== root && other.path?.startsWith(`${root.path}/`))
    )
      errors.push(`${label} root ${root.id}: an ignored root needs retention`);
  return ids;
}

function checkCore(errors, core) {
  if (!isObject(core)) return errors.push('core: must be an object');
  unknownKeys(errors, 'core', core, CORE_KEYS);
  if (core.schema !== WORKSPACE_LAYOUT_CORE_SCHEMA)
    errors.push(`core: schema must be ${WORKSPACE_LAYOUT_CORE_SCHEMA}`);
  for (const key of ['retentionClasses', 'retentionUntil', 'creators'])
    if (!isTextList(core[key])) errors.push(`core: ${key} must be a list`);
  if (errors.length) return;
  return checkRoots(errors, 'core', core.roots, core, CORE_ROOT_KEYS);
}

function checkBinding(errors, binding, core, coreIds) {
  if (!isObject(binding)) return errors.push('binding: must be an object');
  unknownKeys(errors, 'binding', binding, BINDING_KEYS);
  if (binding.schema !== WORKSPACE_LAYOUT_BINDING_SCHEMA)
    errors.push(`binding: schema must be ${WORKSPACE_LAYOUT_BINDING_SCHEMA}`);
  if (binding.guide !== core.guide) errors.push('binding: guide must match the core guide');
  const ids = checkRoots(errors, 'binding', binding.roots, core, BINDING_ROOT_KEYS);
  if (!(ids instanceof Set)) return;
  const folders = binding.archive?.folders ?? [];
  if (
    !isObject(binding.archive) ||
    !isText(binding.archive.path) ||
    !isTextList(folders) ||
    !isText(binding.archive.ruleOwner)
  )
    errors.push('binding: archive needs path, folders and ruleOwner');
  for (const root of binding.roots) {
    const where = `binding root ${root.id}`;
    if ('core' in root && !coreIds?.has(root.core))
      errors.push(`${where}: core root ${root.core} is unknown`);
    if (!isRelativePath(root.ruleOwner))
      errors.push(`${where}: ruleOwner must be a repository path`);
    if ('archive' in root && !folders.includes(root.archive))
      errors.push(`${where}: archive folder ${root.archive} is unknown`);
    if ('marker' in root && !isRelativePath(root.marker))
      errors.push(`${where}: marker must be a repository path`);
    if ('trackedFilesOwner' in root && !isRelativePath(root.trackedFilesOwner))
      errors.push(`${where}: trackedFilesOwner must be a repository path`);
    for (const key of ['reviewInput', 'nestedState', 'overridable'])
      if (key in root && root[key] !== true) errors.push(`${where}: ${key} is a true flag`);
  }
  if (!Array.isArray(binding.toolKinds) || binding.toolKinds.length === 0)
    errors.push('binding: toolKinds must be a list');
  const kinds = new Set();
  for (const [index, kind] of (binding.toolKinds ?? []).entries()) {
    const where = `binding tool kind ${kind?.name ?? index}`;
    if (!isObject(kind)) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    unknownKeys(errors, where, kind, ['name', 'retention', 'overridable']);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(kind.name ?? ''))
      errors.push(`${where}: name must be kebab-case`);
    if (kinds.has(kind.name)) errors.push(`${where}: duplicate kind`);
    kinds.add(kind.name);
    if (!('retention' in kind)) errors.push(`${where}: retention is required`);
    else checkRetention(errors, where, kind.retention, core);
    if (typeof kind.overridable !== 'boolean')
      errors.push(`${where}: overridable must be a boolean`);
  }
  for (const [index, retired] of (Array.isArray(binding.retiredRoots)
    ? binding.retiredRoots
    : [null]
  ).entries()) {
    if (!isObject(retired) || !isText(retired.name) || !ids.has(retired.use))
      errors.push(`binding retired root ${index}: needs a name and the id of the root to use`);
    else unknownKeys(errors, `binding retired root ${retired.name}`, retired, ['name', 'use']);
  }
  if (
    !isTextList(binding.guardExclusions) ||
    new Set(binding.guardExclusions).size !== binding.guardExclusions.length
  )
    errors.push('binding: guardExclusions must list distinct patterns');
  if (!isText(binding.rootLiteralTransitionPlan))
    errors.push('binding: rootLiteralTransitionPlan is required');
  if (!Array.isArray(binding.rootLiteralAllowlist))
    errors.push('binding: rootLiteralAllowlist must be a list');
  for (const [index, entry] of (binding.rootLiteralAllowlist ?? []).entries()) {
    const where = `binding allowlist ${entry?.file ?? index}`;
    if (!isObject(entry)) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    unknownKeys(errors, where, entry, ALLOWLIST_KEYS);
    if (!isRelativePath(entry.file) || !isText(entry.text) || !isText(entry.transition))
      errors.push(`${where}: needs file, text and transition`);
    if (!ALLOWLIST_CATEGORIES.includes(entry.category))
      errors.push(`${where}: category ${entry.category} is unknown`);
    if ('count' in entry && !(Number.isInteger(entry.count) && entry.count > 1))
      errors.push(`${where}: count is an integer above 1`);
  }
}

export function validateWorkspaceLayout({ core, binding }) {
  const errors = [];
  const coreIds = checkCore(errors, core);
  if (!errors.length) checkBinding(errors, binding, core, coreIds);
  if (errors.length) throw new Error(`workspace layout manifest is invalid: ${errors.join('; ')}`);
  return {
    core,
    binding,
    roots: binding.roots,
    toolKinds: new Map(binding.toolKinds.map((kind) => [kind.name, kind])),
    retiredRoots: binding.retiredRoots,
    guardExclusions: binding.guardExclusions,
    rootLiteralAllowlist: binding.rootLiteralAllowlist,
  };
}

function readManifest(url) {
  try {
    return JSON.parse(readFileSync(url, 'utf8'));
  } catch (error) {
    throw new Error(`workspace layout manifest is unreadable: ${url.pathname}: ${error.message}`);
  }
}

let cached;
export function loadWorkspaceLayout() {
  cached ??= validateWorkspaceLayout({
    core: readManifest(CORE_URL),
    binding: readManifest(BINDING_URL),
  });
  return cached;
}

export function workspaceRoot(id, layout = loadWorkspaceLayout()) {
  const root = layout.roots.find((candidate) => candidate.id === id);
  if (!root) throw new Error(`workspace layout manifest has no root ${id}`);
  return root;
}
