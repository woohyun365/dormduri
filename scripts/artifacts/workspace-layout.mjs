// Workspace layout manifest: the core default (logical roots, consumer paths, retention vocabulary) and the KNU
// binding (current root names, KNU-only roots, tools kinds, guard inputs). Field meanings:
// docs/development/agent-workflows/workspace-layout.md
//
// Nothing here reads a file at module load. Hook handlers import modules that import this one, so a missing or
// broken manifest may only fail a caller that asks for a value.
import { readFileSync } from 'node:fs';

export const WORKSPACE_LAYOUT_CORE_SCHEMA = 'htc-workspace-layout-core/v1';
export const WORKSPACE_LAYOUT_BINDING_SCHEMA = 'htc-workspace-layout-binding/v1';

// Repository path of the binding, for messages that ask to add a root.
export const BINDING_FILE = 'scripts/artifacts/workspace-layout.knu.json';
const CORE_URL = new URL('./workspace-layout.core.json', import.meta.url);
const BINDING_URL = new URL('./workspace-layout.knu.json', import.meta.url);

const TRACKING = ['tracked', 'ignored'];
const COPY = ['allowed', 'forbidden', 'unspecified'];
const CHILD_RULES = ['markdown-only', 'declared-plan-id', 'tool-kinds'];
const CORE_KEYS = [
  'schema',
  'guide',
  'retentionClasses',
  'retentionUntil',
  'creators',
  'roots',
  'workNames',
  'workKinds',
  'repositoryModes',
  'trackedScope',
  'checkpoint',
];
// Names of the phase directory below the Plan ID levels; a work kind template may use any work name.
const PHASE_NAMES = ['phase', 'topic'];
const WORK_KIND_KEYS = ['id', 'purpose', 'directories'];
// The scaffold command that writes the consumer workspace files; no work kind may take its name.
export const CONSUMER_COMMAND = 'consumer';
export const WORK_NAME_PLACEHOLDER = /\{([^{}]*)\}/gu;
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
// Fields of the consumer workspace that only the core default holds; a binding maps names and holds none of them.
const CONSUMER_ROOT_KEYS = ['modes', 'ignorable', 'limits', 'indexReadme'];
const LIMIT_KEYS = ['fileBytes', 'totalBytes'];
const TRACKED_SCOPE_KEYS = ['workspace', 'fileBytes'];
const CHECKPOINT_KEYS = ['root', 'heading', 'required', 'optional', 'lineWidth', 'maxLines'];
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
const isCount = (value) => Number.isInteger(value) && value > 0;
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

// Work names are anchored patterns for one directory name; work kinds list directory templates below the phase
// directory, whose `{name}` placeholders are work names.
function checkWorkKinds(errors, core) {
  const names = core.workNames;
  if (!isObject(names)) return errors.push('core: workNames must be an object');
  for (const [name, pattern] of Object.entries(names)) {
    let valid = isText(pattern) && pattern.startsWith('^') && pattern.endsWith('$');
    try {
      new RegExp(pattern, 'u');
    } catch {
      valid = false;
    }
    if (!/^[a-z]+$/u.test(name) || !valid)
      errors.push(`core: work name ${name} must be a lowercase name with an anchored pattern`);
  }
  for (const name of PHASE_NAMES)
    if (!Object.hasOwn(names, name)) errors.push(`core: workNames needs ${name}`);
  if (!Array.isArray(core.workKinds) || core.workKinds.length === 0)
    return errors.push('core: workKinds must be a list');
  const ids = new Set();
  for (const [index, kind] of core.workKinds.entries()) {
    const where = `core work kind ${kind?.id ?? index}`;
    if (!isObject(kind)) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    unknownKeys(errors, where, kind, WORK_KIND_KEYS);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(kind.id ?? ''))
      errors.push(`${where}: id must be kebab-case`);
    if (kind.id === CONSUMER_COMMAND)
      errors.push(`${where}: ${CONSUMER_COMMAND} is the scaffold consumer command`);
    if (ids.has(kind.id)) errors.push(`${where}: duplicate id`);
    ids.add(kind.id);
    if (!isText(kind.purpose)) errors.push(`${where}: purpose is required`);
    if (
      !Array.isArray(kind.directories) ||
      new Set(kind.directories).size !== kind.directories.length
    ) {
      errors.push(`${where}: directories must list distinct templates`);
      continue;
    }
    for (const template of kind.directories) {
      if (
        !isRelativePath(template) ||
        /[{}]/u.test(`${template}`.replace(WORK_NAME_PLACEHOLDER, ''))
      )
        errors.push(`${where}: directory ${template} must be a relative path template`);
      for (const [, name] of `${template}`.matchAll(WORK_NAME_PLACEHOLDER))
        if (!Object.hasOwn(names, name))
          errors.push(`${where}: directory ${template} takes ${name}, which has no work name`);
    }
  }
}

// Repository modes decide which tracked roots exist, `ignorable` marks a tracked root setup may ignore, `limits` sets
// the tracked scope guard's size limits below a root and `indexReadme` a directory whose README scaffold writes.
function checkConsumerRoots(errors, core) {
  for (const root of core.roots) {
    const where = `core root ${root.id}`;
    if (
      'modes' in root &&
      (root.tracking !== 'tracked' ||
        !isTextList(root.modes) ||
        !root.modes.every((mode) => core.repositoryModes.includes(mode)))
    )
      errors.push(`${where}: modes must list repository modes of a tracked root`);
    if ('ignorable' in root && (root.ignorable !== true || root.tracking !== 'tracked'))
      errors.push(`${where}: ignorable is a true flag of a tracked root`);
    if (
      'limits' in root &&
      !(
        isObject(root.limits) &&
        Object.keys(root.limits).length > 0 &&
        Object.entries(root.limits).every(
          ([key, value]) => LIMIT_KEYS.includes(key) && isCount(value),
        )
      )
    )
      errors.push(`${where}: limits holds fileBytes or totalBytes as positive integers`);
    if (
      'indexReadme' in root &&
      (root.indexReadme !== true || root.kind !== 'directory' || root.tracking !== 'tracked')
    )
      errors.push(`${where}: indexReadme is a true flag of a tracked directory root`);
  }
}

// The tracked scope guard reads the roots below the workspace root; the workspace ignores everything but the tracked
// roots and trackedFiles below it, through its own .gitignore.
function checkTrackedScope(errors, core) {
  const scope = core.trackedScope;
  if (!isObject(scope)) return errors.push('core: trackedScope must be an object');
  unknownKeys(errors, 'core trackedScope', scope, TRACKED_SCOPE_KEYS);
  const workspace = core.roots.find((root) => root.id === scope.workspace);
  if (workspace?.kind !== 'directory' || workspace.tracking !== 'ignored')
    errors.push('core: trackedScope workspace must be an ignored directory root');
  else if (
    !core.roots.some(
      (root) =>
        root.path === `${workspace.path}/.gitignore` &&
        root.kind === 'file' &&
        root.tracking === 'tracked',
    )
  )
    errors.push(
      `core: trackedScope workspace needs a tracked file root ${workspace.path}/.gitignore`,
    );
  if (!isCount(scope.fileBytes))
    errors.push('core: trackedScope fileBytes must be a positive integer');
}

// Checkpoint entries of a tracked plan: field names are matched before the first colon of a field line.
function checkCheckpoint(errors, core) {
  const rule = core.checkpoint;
  if (!isObject(rule)) return errors.push('core: checkpoint must be an object');
  unknownKeys(errors, 'core checkpoint', rule, CHECKPOINT_KEYS);
  if (core.roots.find((root) => root.id === rule.root)?.kind !== 'directory')
    errors.push('core: checkpoint root must be a directory root');
  if (!isText(rule.heading)) errors.push('core: checkpoint heading is required');
  if (!isTextList(rule.required) || !Array.isArray(rule.optional) || !rule.optional.every(isText))
    errors.push('core: checkpoint required and optional must list field names');
  else {
    const names = [...rule.required, ...rule.optional];
    if (new Set(names).size !== names.length)
      errors.push('core: checkpoint field names must be distinct across required and optional');
    for (const name of names)
      if (name.includes(':') || name !== name.trim())
        errors.push(`core: checkpoint field ${name} must have no colon or outer space`);
  }
  for (const key of ['lineWidth', 'maxLines'])
    if (!isCount(rule[key])) errors.push(`core: checkpoint ${key} must be a positive integer`);
}

function checkCore(errors, core) {
  if (!isObject(core)) return errors.push('core: must be an object');
  unknownKeys(errors, 'core', core, CORE_KEYS);
  if (core.schema !== WORKSPACE_LAYOUT_CORE_SCHEMA)
    errors.push(`core: schema must be ${WORKSPACE_LAYOUT_CORE_SCHEMA}`);
  for (const key of ['retentionClasses', 'retentionUntil', 'creators', 'repositoryModes'])
    if (!isTextList(core[key])) errors.push(`core: ${key} must be a list`);
  if (errors.length) return;
  checkWorkKinds(errors, core);
  const ids = checkRoots(errors, 'core', core.roots, core, [
    ...CORE_ROOT_KEYS,
    ...CONSUMER_ROOT_KEYS,
  ]);
  if (!(ids instanceof Set)) return;
  checkConsumerRoots(errors, core);
  checkTrackedScope(errors, core);
  checkCheckpoint(errors, core);
  return ids;
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
    // The tracked scope guard reads a root without core as this repository's own agent root.
    if (!('core' in root) && coreIds?.has(root.id))
      errors.push(`${where}: a root without core must not reuse a core root id`);
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
    // The guard matches a nested state root against one path segment.
    if (root.nestedState && root.path?.includes('/'))
      errors.push(`${where}: a nestedState root is one path segment`);
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
    if (
      !isObject(retired) ||
      !isText(retired.name) ||
      retired.name.includes('/') ||
      !ids.has(retired.use)
    )
      errors.push(
        `binding retired root ${index}: needs a one-segment name and the id of the root to use`,
      );
    else unknownKeys(errors, `binding retired root ${retired.name}`, retired, ['name', 'use']);
  }
  if (
    !isTextList(binding.guardExclusions) ||
    new Set(binding.guardExclusions).size !== binding.guardExclusions.length
  )
    errors.push('binding: guardExclusions must list distinct patterns');
  // The guard matches an exclusion against one top-level name, so a pattern has no slash inside.
  else
    for (const pattern of binding.guardExclusions)
      if (pattern.replace(/^\/|\/$/gu, '').includes('/'))
        errors.push(`binding: guard exclusion ${pattern} names more than one path segment`);
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
