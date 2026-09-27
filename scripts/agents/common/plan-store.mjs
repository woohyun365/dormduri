import {
  lstatSync,
  readdirSync,
  openSync,
  readSync,
  fstatSync,
  closeSync,
  constants,
} from 'node:fs';
import { resolve, join } from 'node:path';

export const PLAN_ROOT = '.plans';
const MAX_BYTES = 64 * 1024;
const MAX_ENTRIES = 512;
const TERMINAL = new Set(['completed', 'cancelled', 'superseded']);

// Read-only authoring metadata. Neither this module nor a path grants runtime ownership.
function safePath(root, path) {
  if (typeof path !== 'string' || !/^\.plans\/.+\.md$/u.test(path) || path.includes('\\'))
    throw new Error('unsafe-path');
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.includes('\0')))
    throw new Error('unsafe-path');
  let current = resolve(root);
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))
        throw new Error('unsafe-path');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return current;
}

function metadata(root, path) {
  let fd;
  try {
    const absolute = safePath(root, path);
    fd = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(fd).isFile() || fstatSync(fd).size > MAX_BYTES)
      return { path, state: 'unknown', reasons: ['bounded-read'] };
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    const count = readSync(fd, bytes, 0, bytes.length, 0);
    if (count > MAX_BYTES) return { path, state: 'unknown', reasons: ['bounded-read'] };
    let fence = null;
    const ids = [],
      statuses = [];
    for (const line of bytes.subarray(0, count).toString('utf8').split(/\r?\n/u)) {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (fence) {
        if (
          marker &&
          marker[1][0] === fence.character &&
          marker[1].length >= fence.length &&
          !marker[2].trim()
        )
          fence = null;
        continue;
      }
      if (marker && (marker[1][0] !== '`' || !marker[2].includes('`'))) {
        fence = { character: marker[1][0], length: marker[1].length };
        continue;
      }
      if (/^##\s/u.test(line)) break;
      const field = line.match(/^ {0,3}-\s*(Plan ID|Status|상태):\s*(.*)$/u);
      if (field)
        (field[1] === 'Plan ID' ? ids : statuses).push(
          field[2]
            .trim()
            .replace(/^`([^`]+)`/u, '$1')
            .split(/\s*[;—]\s*/u)[0]
            .trim(),
        );
    }
    const id = ids.length === 1 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(ids[0]) ? ids[0] : null;
    const statusMap = {
      active: 'active',
      'in-progress': 'active',
      draft: 'proposed',
      진행중: 'active',
      초안: 'proposed',
      제안: 'proposed',
      차단: 'blocked',
      '구현 준비 완료': 'implementation-ready',
      'implementation-ready': 'implementation-ready',
      proposed: 'proposed',
      blocked: 'blocked',
      paused: 'paused',
      completed: 'completed',
      complete: 'completed',
      done: 'completed',
      finished: 'completed',
      cancelled: 'cancelled',
      canceled: 'cancelled',
      superseded: 'superseded',
      '진행 중': 'active',
      완료: 'completed',
      취소: 'cancelled',
    };
    const status =
      statuses.length === 1 && Object.hasOwn(statusMap, statuses[0].toLowerCase())
        ? statusMap[statuses[0].toLowerCase()]
        : 'unknown';
    const navigation = path.split('/').at(-1).toLowerCase() === 'readme.md';
    const archived = /^\.plans\/(finished|cancelled)\//u.test(path);
    const state = navigation
      ? 'navigation'
      : archived
        ? 'archived'
        : !id || status === 'unknown'
          ? 'unknown'
          : TERMINAL.has(status)
            ? 'terminal'
            : status === 'implementation-ready'
              ? 'active'
              : status;
    return {
      path,
      id,
      status,
      state,
      reasons:
        (ids.length || statuses.length) && (!id || status === 'unknown')
          ? ['metadata-invalid']
          : [],
    };
  } catch (error) {
    return {
      path,
      state:
        error.code === 'ENOENT'
          ? 'missing'
          : error.message === 'unsafe-path' || error.code === 'ELOOP'
            ? 'unsafe'
            : 'unknown',
      reasons: [error.code === 'ENOENT' ? 'missing-path' : 'unreadable-or-unsafe'],
    };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function inventory(root) {
  const plans = [],
    issues = [];
  let count = 0;
  function visit(path) {
    let entries;
    try {
      const absolute = resolve(root, path),
        stat = lstatSync(absolute);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        issues.push('unsafe-directory');
        return;
      }
      entries = readdirSync(absolute, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    } catch (error) {
      issues.push(error.code === 'ENOENT' ? 'missing-root' : 'unreadable-directory');
      return;
    }
    for (const entry of entries) {
      if (++count > MAX_ENTRIES) {
        issues.push('candidate-limit');
        return;
      }
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        issues.push('unsafe-entry');
        continue;
      }
      if (entry.isDirectory()) visit(child);
      else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name.toLowerCase() !== 'readme.md'
      ) {
        const plan = metadata(root, child);
        plans.push(plan);
        if (plan.reasons.length) issues.push('metadata-unknown');
      }
    }
  }
  visit(PLAN_ROOT);
  const ids = new Map();
  for (const plan of plans) if (plan.id) ids.set(plan.id, (ids.get(plan.id) ?? 0) + 1);
  for (const plan of plans)
    if (ids.get(plan.id) > 1) {
      plan.state = 'ambiguous';
      plan.reasons.push('duplicate-plan-id');
      issues.push('duplicate-plan-id');
    }
  return { plans, issues: [...new Set(issues)], complete: issues.length === 0 };
}

export function discoverPlans(root) {
  const result = inventory(root);
  return {
    ...result,
    plans: result.plans.filter(
      (plan) => plan.path.split('/').length === 2 && plan.state === 'active',
    ),
  };
}

export function readPlan(root, path) {
  const selected = metadata(root, path);
  if (['missing', 'unsafe', 'unknown', 'navigation'].includes(selected.state)) return selected;
  const scan = inventory(root);
  const plan = scan.plans.find((plan) => plan.path === path) ?? selected;
  if (!scan.complete && !['archived', 'terminal', 'ambiguous'].includes(plan.state))
    return { ...plan, state: 'unknown', reasons: [...plan.reasons, ...scan.issues] };
  return plan;
}

export function assessPlanContinuation({
  plan,
  mode,
  explicitlySelected,
  expectedPlanId,
  checkpointSnapshot,
  currentSnapshot,
} = {}) {
  const reasons = [];
  if (mode !== 'resume' || explicitlySelected !== true) reasons.push('explicit-resume-required');
  if (!plan || plan.state !== 'active') reasons.push('active-plan-required');
  if (!expectedPlanId || expectedPlanId !== plan?.id) reasons.push('identity-mismatch');
  for (const snapshot of [checkpointSnapshot, currentSnapshot]) {
    if (
      !snapshot ||
      typeof snapshot.branch !== 'string' ||
      !snapshot.branch ||
      !/^[a-f0-9]{40}$/u.test(snapshot.head ?? '') ||
      !/^[a-f0-9]{64}$/u.test(snapshot.diffHash ?? '')
    )
      reasons.push('snapshot-unknown');
  }
  if (
    !reasons.includes('snapshot-unknown') &&
    ['branch', 'head', 'diffHash'].some((key) => checkpointSnapshot[key] !== currentSnapshot[key])
  )
    reasons.push('source-changed');
  return {
    decision: reasons.length ? 'needs-review' : 'candidate',
    reasons: [...new Set(reasons)],
    grantsExecutionAuthority: false,
  };
}
