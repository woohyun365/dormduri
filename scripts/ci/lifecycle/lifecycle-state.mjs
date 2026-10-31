#!/usr/bin/env node
// Lifecycle state calculator. Pure functions over the state definition (lifecycle-definition.json) and one input
// (`lifecycle-state-input/v1`: project artifacts as document headers or tracking record items, the plan declarations,
// the changed paths and the registered check findings) → `lifecycle-state/v1`: each layer's state, failed guards,
// warnings, skipped guards and registered check failures. Also the implementation boundary judgement, reverse targets,
// the same-fix stop and the implementation-blocked report (`lifecycle-blocked/v1`). Only the CLI and
// collectProjectInputs read files. Callers (hook, `delegate` entry, CI) decide what a result blocks.
// Rules: docs/development/agent-workflows/lifecycle-state-machine.md (계산 규칙).
//
// Usage: node scripts/ci/lifecycle/lifecycle-state.mjs --repo <root> [--input <json>]
// Prints `lifecycle-state/v1` JSON. Without `--input`, or with an input that has no `artifacts`, the project artifacts
// are collected from <root>. Exit 0 = computed (whatever the state), 2 = input error (an unreadable or unparsable input
// or artifact file, LifecycleInputError).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { loadWorkspaceLayout, workspaceRoot } from '../../artifacts/workspace-layout.mjs';
import { parseDocumentHeader } from './document-header.mjs';
import { LIFECYCLE_GRADES, POLICY_GRADES } from './lifecycle-section.mjs';
import {
  createPathTable,
  globToRegExp,
  LifecycleInputError,
  parseArtifactMap,
  parsePathDomains,
} from './policy-first-check.mjs';

export const STATE_SCHEMA = 'lifecycle-state/v1';
export const STATE_INPUT_SCHEMA = 'lifecycle-state-input/v1';
export const BLOCKED_SCHEMA = 'lifecycle-blocked/v1';
// The decision record states of plan readiness (`decisions[].status`, plan-readiness-policy.mjs); the test compares the
// two lists.
export const DECISION_STATES = [
  'known',
  'unknown',
  'deferred',
  'provisional',
  'validated',
  'superseded',
];
// Override lines never lower these (run.mjs `nonOverridable`); the test compares the two lists.
export const NON_OVERRIDABLE = ['L-CONFIRM'];
export const IRREVERSIBLE_UNCONFIRMED = 'irreversible-decision-unconfirmed';
export const UPSTREAM_RECHECK = 'R-UPSTREAM';
export const NO_CHANGED_PATHS = '바뀐 경로 없음';
export const UNCLASSIFIED_NEEDS = '경로 표 행 추가(L-CONFIRM Owner 확인)';

const OWNER_CONFIRMED = 'owner-confirmed';
const DEFAULT_GRADE = 'feature';
const BUGFIX_GRADES = ['bugfix', 'hotfix'];
const REVERSIBILITY = ['easy', 'costly', 'one-way'];
const MAPPINGS = ['doc', 'composite', 'legacy', 'not-applicable'];
const FINDING_LEVELS = ['fail', 'warn', 'pass'];
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ARTIFACT_KINDS = [
  'config',
  'prdOverview',
  'policyDomains',
  'crossCutting',
  'l1',
  'l2',
  'pathDomains',
];
const ARTIFACT_LISTS = ['policyDomains', 'crossCutting', 'l2'];
const PLAN_FIELDS = [
  'domains',
  'layers',
  'paths',
  'readinessPass',
  'implementationReady',
  'decisions',
  'visualClaim',
  'designConfirmation',
];
const INPUT_FIELDS = [
  'schema',
  'grade',
  'artifacts',
  'plan',
  'overrides',
  'changedPaths',
  'bugfixBasis',
  'policyFindings',
  'areaFindings',
  'review',
  'merged',
  'evidenced',
];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sortedUnique = (values) => [...new Set(values)].sort();
// The first artifact of each id, in order.
function uniqueById(artifacts) {
  const seen = new Map();
  for (const artifact of artifacts)
    if (artifact && !seen.has(artifact.id)) seen.set(artifact.id, artifact);
  return [...seen.values()];
}
const isRecord = (artifact) => 'record' in artifact;

// ---------------------------------------------------------------------------------------------------------------------
// Input

function inputReader() {
  const fail = (detail) => {
    throw new LifecycleInputError(`${STATE_INPUT_SCHEMA} 형식 오류: ${detail}`);
  };
  const object = (value, where, allowed, required = []) => {
    if (!isObject(value)) fail(`${where}: 객체가 아님`);
    const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
    if (unknown.length) fail(`${where}: 모르는 field ${unknown.join(', ')}`);
    const missing = required.filter((key) => !(key in value));
    if (missing.length) fail(`${where}: ${missing.join(', ')} 없음`);
  };
  const string = (value, where, pattern = /\S/u) => {
    if (typeof value !== 'string' || !pattern.test(value))
      fail(`${where}: 값 ${JSON.stringify(value)}`);
    return value;
  };
  const strings = (value, where) => {
    if (!Array.isArray(value)) fail(`${where}: 배열이 아님`);
    value.forEach((item, index) => string(item, `${where}[${index}]`));
    return value;
  };
  const boolean = (value, where) => {
    if (typeof value !== 'boolean') fail(`${where}: boolean이 아님`);
    return value;
  };
  const oneOf = (value, values, where) => {
    if (!values.includes(value)) fail(`${where}: 값 ${JSON.stringify(value)}`);
    return value;
  };
  const optional = (value, read) => (value === undefined || value === null ? null : read(value));
  return { fail, object, string, strings, boolean, oneOf, optional };
}

function readArtifact(read, value, where) {
  read.object(value, where, ['id', 'path', 'header', 'record', 'table'], ['id', 'path']);
  read.string(value.id, `${where}.id`);
  read.string(value.path, `${where}.path`);
  const kinds = ['header', 'record', 'table'].filter((key) => key in value);
  if (kinds.length > 1) read.fail(`${where}: header·record·table 가운데 하나만`);
  if ('header' in value && value.header !== null) {
    read.object(
      value.header,
      `${where}.header`,
      ['status', 'confirmedOn', 'confirmationRef', 'basis', 'keys'],
      ['status', 'basis'],
    );
    read.strings(value.header.basis, `${where}.header.basis`);
  }
  if ('record' in value) {
    const { record } = value;
    read.object(record, `${where}.record`, ['mapping', 'sources', 'confirmedBy'], ['mapping']);
    read.oneOf(record.mapping, MAPPINGS, `${where}.record.mapping`);
    read.strings(record.sources ?? [], `${where}.record.sources`);
    read.object(
      record.confirmedBy,
      `${where}.record.confirmedBy`,
      ['status', 'date', 'basis'],
      ['status', 'date'],
    );
  }
  if ('table' in value) parsePathDomains(JSON.stringify(value.table));
  return value;
}

function readFindings(read, value, where) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) read.fail(`${where}: 배열이 아님`);
  return value.map((finding, index) => {
    read.object(finding, `${where}[${index}]`, ['check', 'level', 'reason'], ['check', 'level']);
    read.string(finding.check, `${where}[${index}].check`);
    read.oneOf(finding.level, FINDING_LEVELS, `${where}[${index}].level`);
    return { check: finding.check, level: finding.level, reason: String(finding.reason ?? '') };
  });
}

function readPlan(read, value) {
  read.object(value, 'plan', PLAN_FIELDS);
  for (const field of ['domains', 'layers', 'paths'])
    if (field in value) read.strings(value[field], `plan.${field}`);
  if (value.readinessPass !== undefined && value.readinessPass !== null) {
    read.object(value.readinessPass, 'plan.readinessPass', ['date'], ['date']);
    read.string(value.readinessPass.date, 'plan.readinessPass.date', DATE);
  }
  for (const field of ['implementationReady', 'visualClaim'])
    if (field in value) read.boolean(value[field], `plan.${field}`);
  if ('decisions' in value) {
    if (!Array.isArray(value.decisions)) read.fail('plan.decisions: 배열이 아님');
    value.decisions.forEach((decision, index) => {
      const where = `plan.decisions[${index}]`;
      read.object(
        decision,
        where,
        ['id', 'irreversible', 'status', 'ownerConfirmation'],
        ['id', 'irreversible', 'status'],
      );
      read.string(decision.id, `${where}.id`);
      read.boolean(decision.irreversible, `${where}.irreversible`);
      read.oneOf(decision.status, DECISION_STATES, `${where}.status`);
      if (decision.ownerConfirmation !== undefined && decision.ownerConfirmation !== null) {
        read.object(
          decision.ownerConfirmation,
          `${where}.ownerConfirmation`,
          ['date', 'source'],
          ['date', 'source'],
        );
        read.string(decision.ownerConfirmation.date, `${where}.ownerConfirmation.date`, DATE);
        read.string(decision.ownerConfirmation.source, `${where}.ownerConfirmation.source`);
      }
    });
  }
  // The visual direction confirmation: where the confirmation is written, the confirmed artifact and its revision.
  if (value.designConfirmation !== undefined && value.designConfirmation !== null) {
    const fields = ['source', 'artifact', 'revision'];
    read.object(value.designConfirmation, 'plan.designConfirmation', fields, fields);
    for (const field of fields)
      read.string(value.designConfirmation[field], `plan.designConfirmation.${field}`);
  }
  return value;
}

// Required: schema, artifacts. A missing grade is feature, as for a PR body without a grade line.
function normalizeInput(input) {
  const read = inputReader();
  read.object(input, '입력', INPUT_FIELDS, ['schema', 'artifacts']);
  if (input.schema !== STATE_INPUT_SCHEMA)
    read.fail(`모르는 schema ${JSON.stringify(input.schema)}`);
  const grade = read.optional(input.grade, (value) =>
    LIFECYCLE_GRADES.includes(value) ? value : read.fail(`모르는 등급 ${JSON.stringify(value)}`),
  );

  read.object(input.artifacts, 'artifacts', ARTIFACT_KINDS);
  const artifacts = Object.fromEntries(
    ARTIFACT_KINDS.map((kind) => {
      const value = input.artifacts[kind];
      if (value === undefined || value === null) return [kind, null];
      if (!ARTIFACT_LISTS.includes(kind))
        return [kind, readArtifact(read, value, `artifacts.${kind}`)];
      if (!Array.isArray(value)) read.fail(`artifacts.${kind}: 배열이 아님`);
      return [
        kind,
        value.map((item, index) => readArtifact(read, item, `artifacts.${kind}[${index}]`)),
      ];
    }),
  );

  const overrides = input.overrides ?? [];
  if (!Array.isArray(overrides)) read.fail('overrides: 배열이 아님');
  overrides.forEach((line, index) => {
    read.object(
      line,
      `overrides[${index}]`,
      ['check', 'reason', 'revisit'],
      ['check', 'reason', 'revisit'],
    );
    for (const key of ['check', 'reason', 'revisit'])
      read.string(line[key], `overrides[${index}].${key}`);
  });

  const review = read.optional(input.review, (value) => {
    read.object(value, 'review', ['pass', 'settled', 'findings'], ['pass', 'settled']);
    read.boolean(value.pass, 'review.pass');
    read.boolean(value.settled, 'review.settled');
    return {
      pass: value.pass,
      settled: value.settled,
      findings: readFindings(read, value.findings, 'review.findings'),
    };
  });

  return {
    grade,
    artifacts,
    plan: read.optional(input.plan, (value) => readPlan(read, value)),
    overrides,
    changedPaths: read.strings(input.changedPaths ?? [], 'changedPaths'),
    bugfixBasis: read.optional(input.bugfixBasis, (value) =>
      read.oneOf(value, ['found', 'missing'], 'bugfixBasis'),
    ),
    policyFindings: readFindings(read, input.policyFindings, 'policyFindings'),
    areaFindings: readFindings(read, input.areaFindings, 'areaFindings'),
    review,
    merged: read.boolean(input.merged ?? false, 'merged'),
    evidenced: read.boolean(input.evidenced ?? false, 'evidenced'),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Artifacts

// Confirmation of one artifact: a document by its header, a tracking record item by the record's Owner confirmation
// (every mapping, `not-applicable` included, counts only with it; `legacy` counts and is marked).
function confirmation(artifact) {
  if (isRecord(artifact)) {
    const { mapping, confirmedBy } = artifact.record;
    const confirmed = confirmedBy.status === OWNER_CONFIRMED;
    return {
      confirmed,
      date: confirmed && DATE.test(confirmedBy.date ?? '') ? confirmedBy.date : null,
      legacy: confirmed && mapping === 'legacy',
      state: `대응 기록 ${mapping}, 확인 ${confirmedBy.status}`,
    };
  }
  const header = artifact.header ?? null;
  const confirmed = header?.status === OWNER_CONFIRMED;
  return {
    confirmed,
    date: confirmed && DATE.test(header.confirmedOn ?? '') ? header.confirmedOn : null,
    legacy: false,
    state: header ? `header 상태 ${header.status ?? '없음'}` : 'header 없음',
  };
}

// Artifacts the upstream comparison reads: PRD overview, policies, L1 and L2, once each.
const upstreamArtifacts = (artifacts) =>
  uniqueById([
    artifacts.prdOverview,
    ...(artifacts.policyDomains ?? []),
    ...(artifacts.crossCutting ?? []),
    artifacts.l1,
    ...(artifacts.l2 ?? []),
  ]);

const findPolicy = (artifacts, domain) =>
  [...(artifacts.policyDomains ?? []), ...(artifacts.crossCutting ?? [])].find(
    (artifact) => artifact.id === `policy:${domain}`,
  ) ?? null;

// A `근거` link target as a repository path: relative to the document, `/` from the root. URLs, bare anchors and links
// leaving the repository give null.
function linkPath(from, link) {
  const target = link.split('#')[0].split('?')[0];
  if (!target || /^[a-z][a-z0-9+.-]*:/iu.test(target)) return null;
  const path = posix.normalize(
    target.startsWith('/') ? target.slice(1) : posix.join(posix.dirname(from), target),
  );
  return path.startsWith('../') || path === '..' ? null : path;
}

// R-UPSTREAM. A header document needs a recheck when an artifact its `근거` links to (found by path; a record item by
// its sources) was confirmed later than the document. A record item's date is its record's confirmedBy.date. The plan
// needs a recheck when its readiness PASS date is earlier than the PRD overview, L1 or a declared domain policy
// confirmation, or a declared domain policy needs a recheck.
export function upstreamRecheck({ artifacts, plan }) {
  const all = upstreamArtifacts(artifacts);
  const byPath = new Map();
  for (const artifact of all)
    for (const path of isRecord(artifact) ? (artifact.record.sources ?? []) : [artifact.path])
      if (!byPath.has(path)) byPath.set(path, artifact);

  const recheck = [];
  for (const artifact of all) {
    if (isRecord(artifact) || !artifact.header) continue;
    const own = confirmation(artifact).date;
    if (!own) continue;
    const upstream = artifact.header.basis.flatMap((link) => {
      const found = byPath.get(linkPath(artifact.path, link));
      const date = found && found.id !== artifact.id ? confirmation(found).date : null;
      return date && date > own ? [found.id] : [];
    });
    if (upstream.length) recheck.push({ id: artifact.id, upstream: sortedUnique(upstream) });
  }

  const reasons = [];
  if (plan) {
    const rechecked = new Set(recheck.map((entry) => entry.id));
    const declared = (plan.domains ?? [])
      .map((domain) => findPolicy(artifacts, domain))
      .filter(Boolean);
    const pass = plan.readinessPass?.date ?? null;
    if (pass)
      for (const artifact of uniqueById([artifacts.prdOverview, artifacts.l1, ...declared])) {
        const date = confirmation(artifact).date;
        if (date && pass < date)
          reasons.push(`readiness PASS ${pass}가 ${artifact.id} 확인일 ${date}보다 이름`);
      }
    for (const artifact of declared)
      if (rechecked.has(artifact.id)) reasons.push(`선언 도메인 정책 재확인 필요: ${artifact.id}`);
  }
  return { artifacts: recheck, plan: { stale: reasons.length > 0, reasons } };
}

// ---------------------------------------------------------------------------------------------------------------------
// State

const failure = (id, reason, needs, check = null) => ({ id, reason, needs, check });
const publicFailure = ({ id, reason, needs }) => ({ id, reason, needs });

function artifactFailures(id, artifact, label) {
  if (!artifact) return [failure(id, `${label} 없음`, `${label}(owner-confirmed)`)];
  const { confirmed, state } = confirmation(artifact);
  return confirmed
    ? []
    : [
        failure(
          id,
          `${label} 미확인: ${artifact.id}(${state})`,
          `${artifact.path}(owner-confirmed)`,
        ),
      ];
}

const l1Failures = (artifacts) => artifactFailures('P-ARCH', artifacts.l1, 'L1 개요');

const PROJECT_RULES = {
  'P-INIT': ({ config }) =>
    config
      ? []
      : [
          failure(
            'P-INIT',
            'repo binding 없음',
            'repo binding(.htc/config.json 또는 binding의 제품 root 대응)',
          ),
        ],
  // The grade is always computed (a missing grade is feature, an unknown one an input error); the record is reviewed.
  'P-GRADE': () => [],
  'P-DIRECTION': (artifacts) => artifactFailures('P-DIRECTION', artifacts.prdOverview, 'PRD 개요'),
  'P-POLICY-SET': ({ policyDomains, crossCutting }) => [
    ...(policyDomains
      ? []
      : [failure('P-POLICY-SET', '정책 도메인 목록 없음', '정책 도메인 목록')]),
    ...(crossCutting
      ? []
      : [
          failure(
            'P-POLICY-SET',
            'cross-cutting 대상 목록 없음',
            'cross-cutting 대상 목록(고위험 trigger 포함)',
          ),
        ]),
  ],
  'P-POLICY-BASE': ({ crossCutting }) =>
    (crossCutting ?? []).flatMap((artifact) =>
      artifactFailures('P-POLICY-BASE', artifact, 'cross-cutting 정책'),
    ),
  'P-ARCH': (artifacts) => [
    ...l1Failures(artifacts),
    ...(artifacts.l2?.length
      ? []
      : [failure('P-ARCH', 'L2 결정 기록 없음', 'L2 기록(L1 결정의 결정 기록)')]),
    ...(artifacts.pathDomains
      ? []
      : [failure('P-ARCH', '경로 표 없음', '경로 표(경로 → 정책 도메인)')]),
  ],
};

function ruleFor(rules, id) {
  const rule = rules[id];
  if (!rule) throw new TypeError(`계산 규칙이 없는 guard: ${id}`);
  return rule;
}

// Each layer stops at the first state whose guard fails; the other guards leaving that state are still computed.
function computeProject(value, definition) {
  const layerOf = new Map(definition.states.map((state) => [state.id, state.layer]));
  const guards = definition.guards.filter((guard) => layerOf.get(guard.state) === 'project');
  let stop = null;
  const failed = [];
  for (const guard of guards) {
    if (stop !== null && guard.state !== stop) break;
    const failures = ruleFor(PROJECT_RULES, guard.id)(value.artifacts);
    if (failures.length) {
      failed.push(...failures.map(publicFailure));
      stop ??= guard.state;
    }
  }
  const legacy = upstreamArtifacts(value.artifacts)
    .filter((artifact) => confirmation(artifact).legacy)
    .map((artifact) => artifact.id);
  return {
    state: stop ?? definition.states.filter((state) => state.layer === 'project').at(-1).id,
    failed,
    legacy,
  };
}

function judgedDomains(value) {
  const table = value.artifacts.pathDomains?.table;
  if (!table) return { domains: [], unclassified: [] };
  const paths = createPathTable(table);
  const product = value.changedPaths.filter(paths.isProductPath);
  return {
    domains: sortedUnique(product.flatMap(paths.domainsOf)),
    unclassified: product.filter(
      (path) => !paths.domainsOf(path).length && !paths.isNoDomain(path),
    ),
  };
}

function unconfirmedDecisions(decisions) {
  return (decisions ?? []).filter(
    (decision) =>
      decision.irreversible &&
      (['unknown', 'provisional'].includes(decision.status) ||
        (decision.status === 'validated' && !decision.ownerConfirmation)),
  );
}

const WORK_RULES = {
  'W-SCOPE': ({ value, project, onPlanned }) => {
    const plan = value.plan ?? {};
    const missing = [
      ...['domains', 'layers'].filter((field) => !Array.isArray(plan[field])),
      ...(plan.paths?.length ? [] : ['paths']),
    ];
    return [
      ...(onPlanned && project.failed.length
        ? [
            failure(
              'W-SCOPE',
              `프로젝트 층이 architected가 아님: ${project.failed[0].id} 실패`,
              `프로젝트 층 architected(${project.failed[0].needs})`,
            ),
          ]
        : []),
      ...(missing.length
        ? [
            failure(
              'W-SCOPE',
              `plan 선언 없음: ${missing.join(', ')}`,
              'plan의 바뀌는 정책 도메인·하위 layer·경로 선언',
            ),
          ]
        : []),
    ];
  },
  'W-POLICY': ({ value, domains, recheck, compareDates }) =>
    domains.flatMap((domain) => {
      const artifact = findPolicy(value.artifacts, domain);
      if (!artifact)
        return [
          failure('W-POLICY', `정책 문서 없음: ${domain}`, `정책 ${domain}(owner-confirmed)`),
        ];
      const { confirmed, state } = confirmation(artifact);
      if (!confirmed)
        return [
          failure(
            'W-POLICY',
            `정책 미확인: ${domain}(${state})`,
            `${artifact.path}(owner-confirmed)`,
          ),
        ];
      const entry = compareDates ? recheck.artifacts.find((item) => item.id === artifact.id) : null;
      return entry
        ? [
            failure(
              'W-POLICY',
              UPSTREAM_RECHECK,
              `${artifact.id} 재확인(근거 ${entry.upstream.join(', ')}가 더 늦게 확인됨)`,
            ),
          ]
        : [];
    }),
  'W-DESIGN': ({ value }) =>
    value.plan?.designConfirmation
      ? []
      : [
          failure(
            'W-DESIGN',
            '시각 방향 확정 기록 없음',
            '시각 방향 확정 기록(확정 원문과 본 산출물의 경로·revision)',
          ),
        ],
  'W-READY': ({ value, recheck }) => {
    const plan = value.plan ?? {};
    const unconfirmed = unconfirmedDecisions(plan.decisions);
    return [
      ...(plan.implementationReady === true
        ? []
        : [
            failure(
              'W-READY',
              'plan implementation-ready 아님',
              'plan readiness PASS와 implementation-ready',
            ),
          ]),
      ...(plan.readinessPass
        ? []
        : [
            failure(
              'W-READY',
              'readiness PASS 날짜 없음',
              'plan Status 또는 PR 본문 readiness 근거 줄의 PASS 날짜',
            ),
          ]),
      ...(unconfirmed.length
        ? [
            failure(
              'W-READY',
              IRREVERSIBLE_UNCONFIRMED,
              `Owner 확인: ${unconfirmed.map((decision) => `${decision.id}(${decision.status})`).join(', ')}`,
            ),
          ]
        : []),
      ...(recheck.plan.stale
        ? [failure('W-READY', UPSTREAM_RECHECK, recheck.plan.reasons.join('; '))]
        : []),
    ];
  },
  'W-PATHS': ({ value }) => {
    if (!value.changedPaths.length) return [failure('W-PATHS', NO_CHANGED_PATHS, '구현 변경')];
    const globs = (value.plan?.paths ?? []).map(globToRegExp);
    const outside = value.changedPaths.filter((path) => !globs.some((glob) => glob.test(path)));
    return outside.length
      ? [
          failure(
            'W-PATHS',
            `plan 경로 선언 밖: ${outside.join(', ')}`,
            'plan 경로 선언 안의 변경 또는 선언 갱신',
          ),
        ]
      : [];
  },
  'W-REVIEW': ({ value }) => [
    ...(value.review?.pass ? [] : [failure('W-REVIEW', '독립 리뷰 PASS 없음', '독립 리뷰 PASS')]),
    ...(value.review?.settled ? [] : [failure('W-REVIEW', '리뷰 정산 없음', '리뷰 정산')]),
  ],
  'W-MERGE': ({ value }) =>
    value.merged ? [] : [failure('W-MERGE', 'merge 안 됨', 'required check green과 merge')],
  'W-EVID': ({ value }) =>
    value.evidenced ? [] : [failure('W-EVID', 'evidence 단계 미완료', 'evidence 단계 완료')],
};

const CONDITIONS = {
  'visual-quality-claim': (value) => value.plan?.visualClaim === true,
};

function conditionHolds(condition, value) {
  const holds = CONDITIONS[condition];
  if (!holds) throw new TypeError(`계산 규칙이 없는 조건: ${condition}`);
  return holds(value);
}

function computeWork(value, definition, { grade, project, recheck }) {
  const gradeRule = definition.grades[grade];
  const workStates = definition.states
    .filter((state) => state.layer === 'work')
    .map((state) => state.id);
  const order = (state) => workStates.indexOf(state);
  const checks = new Map(definition.checks.map((check) => [check.id, check]));
  const failed = [];
  const warnings = [];
  const checkFailures = [];

  const overrideFor = (entry) =>
    value.overrides.find(
      (line) =>
        !NON_OVERRIDABLE.includes(line.check) &&
        (line.check === entry.id || line.check === entry.check),
    );
  // A fail goes to `failed` unless an override line lowers it to a warning; returns whether it stays a fail.
  const settle = (entry, warnOnly) => {
    const override = warnOnly ? null : overrideFor(entry);
    if (warnOnly) warnings.push({ id: entry.id, reason: entry.reason });
    else if (override)
      warnings.push({
        id: entry.id,
        reason: entry.reason,
        override: { reason: override.reason, revisit: override.revisit },
      });
    else failed.push(publicFailure(entry));
    return !warnOnly && !override;
  };

  // Registered check findings: a warn is a warning; a fail of a check with a guard is that guard's fail; a fail of a
  // check without one changes no state and is a check failure. Parenthesised output labels (`(경로)`, `(형식)`) are
  // not checks and are not read; any other id outside `checks` is an input error.
  const guardFindings = new Map();
  const findings = [
    ...value.policyFindings,
    ...value.areaFindings,
    ...(value.review?.findings ?? []),
  ].filter((finding) => {
    if (checks.has(finding.check)) return true;
    if (/^\(.+\)$/u.test(finding.check)) return false;
    throw new LifecycleInputError(`등록 검사에 없는 finding check: ${finding.check}`);
  });
  for (const finding of findings) {
    const { guard } = checks.get(finding.check);
    if (finding.level === 'warn') warnings.push({ id: finding.check, reason: finding.reason });
    if (finding.level !== 'fail') continue;
    if (guard)
      guardFindings.set(guard, [
        ...(guardFindings.get(guard) ?? []),
        failure(
          guard,
          `${finding.check}: ${finding.reason}`,
          `${finding.check} 검사 통과`,
          finding.check,
        ),
      ]);
    else {
      const entry = failure(finding.check, finding.reason, null, finding.check);
      const override = overrideFor(entry);
      if (override)
        warnings.push({
          id: entry.id,
          reason: entry.reason,
          override: { reason: override.reason, revisit: override.revisit },
        });
      else checkFailures.push({ id: entry.id, reason: entry.reason });
    }
  }

  // Project layer before the grade's first state: planned grades through W-SCOPE, bugfix·hotfix take the project
  // layer's first failed guard as is, trivial only the L1 confirmation of P-ARCH.
  let stop = null;
  const onPlanned = gradeRule.path.includes('planned');
  if (!onPlanned) {
    const gate = BUGFIX_GRADES.includes(grade)
      ? project.failed.map((entry) => failure(entry.id, entry.reason, entry.needs))
      : l1Failures(value.artifacts);
    for (const entry of gate) if (settle(entry, false)) stop = gradeRule.path[0];
  }

  const { domains: judged, unclassified } = judgedDomains(value);
  const context = {
    value,
    project,
    recheck,
    onPlanned,
    domains: sortedUnique([...(value.plan?.domains ?? []), ...judged]),
    compareDates: POLICY_GRADES.includes(grade),
  };
  const layerOf = new Map(definition.states.map((state) => [state.id, state.layer]));
  for (const guard of definition.guards.filter((entry) => layerOf.get(entry.state) === 'work')) {
    if (stop !== null && order(guard.state) > order(stop)) break;
    if (gradeRule.skip.includes(guard.id)) continue;
    const warnOnly = gradeRule.warnOnly.includes(guard.id);
    if (!warnOnly && !gradeRule.path.includes(guard.state)) continue;
    if (guard.condition && !conditionHolds(guard.condition, value)) continue;
    if (guard.id === 'W-SCOPE')
      for (const path of unclassified)
        warnings.push({
          id: 'W-SCOPE',
          reason: `미분류 제품 경로: ${path}`,
          needs: UNCLASSIFIED_NEEDS,
        });
    const entries = [
      ...ruleFor(WORK_RULES, guard.id)(context),
      ...(guardFindings.get(guard.id) ?? []),
    ];
    for (const entry of entries) if (settle(entry, warnOnly)) stop ??= guard.state;
  }

  for (const line of value.overrides)
    if (NON_OVERRIDABLE.includes(line.check))
      warnings.push({
        id: line.check,
        reason: `override 대상이 아님: ${line.reason} — 재검토: ${line.revisit}`,
      });

  return {
    state: stop ?? gradeRule.path.at(-1),
    failed,
    warnings,
    skipped: [...gradeRule.skip],
    checkFailures,
  };
}

export function computeLifecycleState(input, definition) {
  if (definition?.schema !== 'lifecycle-definition/v1')
    throw new TypeError(`상태 정의 schema가 아님: ${definition?.schema}`);
  const value = normalizeInput(input);
  const declared = value.grade;
  let effective = declared ?? DEFAULT_GRADE;
  let raised = null;
  if (BUGFIX_GRADES.includes(effective) && value.bugfixBasis === 'missing') {
    raised = `고칠 기준이 정책에 없음(bugfixBasis missing): ${effective}를 feature로 올림`;
    effective = 'feature';
  }
  const recheck = upstreamRecheck({ artifacts: value.artifacts, plan: value.plan });
  const project = computeProject(value, definition);
  const work = computeWork(value, definition, { grade: effective, project, recheck });
  return {
    schema: STATE_SCHEMA,
    grade: { declared, effective, raised },
    project: { ...project, recheck: recheck.artifacts },
    work,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Boundary, reverse transitions, blocked report

// Implementation boundary (guide: 구현 불가 경계): outside the pack decision list, easily reversible and inside the declared scope is a
// Lead decision, not a trigger. Any input outside that is an R-AMBIG block; `reasons` names those inputs.
export function evaluateBoundary({ packDecisionId, reversibility, inScope } = {}) {
  if (packDecisionId !== null && (typeof packDecisionId !== 'string' || !packDecisionId.trim()))
    throw new LifecycleInputError(`packDecisionId: 값 ${JSON.stringify(packDecisionId)}`);
  if (!REVERSIBILITY.includes(reversibility))
    throw new LifecycleInputError(`reversibility: 값 ${JSON.stringify(reversibility)}`);
  if (typeof inScope !== 'boolean')
    throw new LifecycleInputError(`inScope: 값 ${JSON.stringify(inScope)}`);
  const reasons = [
    ...(packDecisionId === null ? [] : ['packDecisionId']),
    ...(reversibility === 'easy' ? [] : ['reversibility']),
    ...(inScope ? [] : ['inScope']),
  ];
  return reasons.length
    ? { blocked: true, reverse: 'R-AMBIG', reasons }
    : { blocked: false, reverse: null, reasons };
}

// Where a reverse transition returns: R-REJECT to the start of the reviewed state, a per-grade target by the grade, any
// other the definition's target (a state, candidates or a marker).
export function reverseTarget(id, { grade, reviewedState } = {}, definition) {
  const entry = definition.reverse.find((candidate) => candidate.id === id);
  if (!entry) throw new LifecycleInputError(`모르는 역전이: ${id}`);
  if (entry.target === 'reviewed-state-start') {
    if (!definition.states.some((state) => state.id === reviewedState))
      throw new LifecycleInputError(`reviewedState: 값 ${JSON.stringify(reviewedState)}`);
    return reviewedState;
  }
  if (isObject(entry.target)) {
    if (!(grade in entry.target))
      throw new LifecycleInputError(`${id} 등급: 값 ${JSON.stringify(grade)}`);
    return entry.target[grade];
  }
  return entry.target;
}

// The same defect's fix failed `sameFixLimit` times: stop and ask the Owner whether it is a structure problem. The agent
// counts the failures.
export function sameFixStop({ grade, failedFixes } = {}, definition) {
  if (!LIFECYCLE_GRADES.includes(grade))
    throw new LifecycleInputError(`등급: 값 ${JSON.stringify(grade)}`);
  if (!Number.isInteger(failedFixes) || failedFixes < 0)
    throw new LifecycleInputError(`failedFixes: 값 ${JSON.stringify(failedFixes)}`);
  const { sameFixLimit } = definition.reverse.find((entry) => entry.id === 'R-SIGNAL');
  return failedFixes >= sameFixLimit
    ? {
        reverse: 'R-SIGNAL',
        target: reverseTarget('R-SIGNAL', { grade }, definition),
        ask: 'structure',
      }
    : null;
}

// `lifecycle-blocked/v1` fields: every field is required and no other field is allowed.
const fields = (shape) => ({ fields: shape });
const items = (shape) => ({ items: shape });
const BLOCKED_SHAPE = fields({
  schema: null,
  request: null,
  state: fields({ project: null, work: null }),
  failedGuards: items(fields({ id: null, reason: null, needs: null })),
  questions: items(
    fields({
      id: null,
      guard: null,
      decisionRef: null,
      text: null,
      options: items(fields({ id: null, summary: null, tradeoff: null })),
      default: fields({ option: null, why: null }),
      reversible: null,
      expertCheck: null,
    }),
  ),
  resume: null,
  inspected: null,
});

function shapeIssues(value, shape, where, issues) {
  if (shape?.fields) {
    const keys = isObject(value) ? Object.keys(value) : [];
    for (const key of keys)
      if (!(key in shape.fields)) issues.push({ field: `${where}${key}`, code: 'unknown-field' });
    for (const [key, child] of Object.entries(shape.fields)) {
      if (!keys.includes(key)) issues.push({ field: `${where}${key}`, code: 'missing-field' });
      else if (child?.fields) shapeIssues(value[key], child, `${where}${key}.`, issues);
      else if (child?.items) {
        if (!Array.isArray(value[key]))
          issues.push({ field: `${where}${key}`, code: 'missing-field' });
        else
          value[key].forEach((item, index) =>
            shapeIssues(item, child.items, `${where}${key}[${index}].`, issues),
          );
      }
    }
  }
  return issues;
}

// → [{ field, code }]: `unknown-field` outside the schema, `missing-field` for an absent field (a `schema` other than
// lifecycle-blocked/v1 counts as an absent one).
export function validateBlockedReport(block) {
  const issues = shapeIssues(block, BLOCKED_SHAPE, '', []);
  if (isObject(block) && 'schema' in block && block.schema !== BLOCKED_SCHEMA)
    issues.push({ field: 'schema', code: 'missing-field' });
  return issues;
}

export function buildBlockedReport({
  request,
  state,
  failedGuards,
  questions,
  resume,
  inspected,
  ...rest
} = {}) {
  const block = {
    schema: BLOCKED_SCHEMA,
    request,
    state,
    failedGuards,
    questions,
    resume,
    inspected,
    ...rest,
  };
  for (const key of Object.keys(block)) if (block[key] === undefined) delete block[key];
  const issues = validateBlockedReport(block);
  if (issues.length)
    throw new LifecycleInputError(
      `${BLOCKED_SCHEMA} 필드 오류: ${issues.map((issue) => `${issue.field} ${issue.code}`).join(', ')}`,
    );
  return block;
}

const cell = (text) =>
  String(text ?? '-')
    .replace(/\r?\n/gu, ' ')
    .replace(/\\/gu, '\\\\')
    .replace(/\|/gu, '\\|');
const code = (text) => (text === null || text === undefined ? '없음' : `\`${text}\``);

export function renderBlockedMarkdown(block) {
  const questions = block.questions.flatMap((question, index) => [
    `${index + 1}. ${question.text} (guard ${code(question.guard)}, 결정 ${question.decisionRef === null ? '목록 밖' : code(question.decisionRef)}, 되돌림 ${code(question.reversible)}${question.expertCheck ? ', 전문가 확인 필요' : ''})`,
    `   - 권장 ${code(question.default.option)}: ${question.default.why}`,
    ...question.options.map(
      (option) => `   - ${code(option.id)} ${option.summary} — ${option.tradeoff}`,
    ),
  ]);
  return [
    `### 구현 불가: ${block.request}`,
    '',
    `- 상태: 프로젝트 층 ${code(block.state.project)}, 작업 층 ${code(block.state.work)}`,
    `- 재개 조건: ${block.resume.length ? block.resume.join('; ') : '없음'}`,
    `- 판정 근거(읽은 파일): ${block.inspected.length ? block.inspected.map(code).join(', ') : '없음'}`,
    '',
    '| guard | 이유 | 필요 산출물 |',
    '| --- | --- | --- |',
    ...block.failedGuards.map(
      (entry) => `| ${cell(entry.id)} | ${cell(entry.reason)} | ${cell(entry.needs)} |`,
    ),
    '',
    '#### 다음 질문',
    '',
    ...(questions.length ? questions : ['없음']),
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------------------------------
// Project inputs from a repository

// Project artifacts of a repository. readFile(path) → text | null, listFiles(directory) → repository paths under it.
// Locations come from the workspace layout roots. A document with a header is judged by its header, else by its
// tracking record item (artifact map), else it is a document without a header. Without a `config` root (KNU) the
// binding's product root stands for the config. Policy lists and cross-cutting targets come from the tracking record
// (`policy:<name>` items, level `cross-cutting`) and the policy documents; L2 is every decision record with a header
// under the decisions root plus the record's `l2:` items.
// A document has a header when its key lines carry a status line; key lines without one are read as no header, the
// same rule as headerStatus of the policy-first check.
const hasStatusHeader = (document) => Boolean(document?.header?.status);

// A repository-relative path that stays inside the repository.
function insideRepository(path) {
  const normal = posix.normalize(path);
  return !posix.isAbsolute(normal) && normal !== '..' && !normal.startsWith('../');
}

export function collectProjectInputs({
  readFile,
  listFiles = () => [],
  layout = loadWorkspaceLayout(),
}) {
  const root = (id) => {
    try {
      return workspaceRoot(id, layout);
    } catch {
      return null;
    }
  };
  const mapRoot = root('artifact-map');
  const mapText = mapRoot ? readFile(mapRoot.path) : null;
  const map = mapText === null ? null : parseArtifactMap(mapText);
  const item = (id) => map?.artifacts.find((entry) => entry.artifact === id) ?? null;
  const documentAt = (id, path) => {
    const text = path ? readFile(path) : null;
    return text === null ? null : { id, path, header: parseDocumentHeader(text) };
  };
  const artifact = (id, path) => {
    const document = documentAt(id, path);
    if (hasStatusHeader(document)) return document;
    const entry = item(id);
    if (entry)
      return {
        id,
        path: mapRoot.path,
        record: {
          mapping: entry.mapping,
          sources: entry.sources ?? [],
          confirmedBy: map.confirmedBy,
        },
      };
    return document;
  };
  const markdownUnder = (directory) =>
    listFiles(directory).filter(
      (path) => path.endsWith('.md') && posix.basename(path) !== 'README.md',
    );

  const configRoot = root('config');
  const productRoot = root('product');
  let config = null;
  if (configRoot)
    config = readFile(configRoot.path) === null ? null : { id: 'config', path: configRoot.path };
  else if (productRoot) config = { id: 'config', path: productRoot.path };

  const policiesRoot = root('policies');
  const recordPolicies = (map?.artifacts ?? [])
    .filter((entry) => entry.artifact.startsWith('policy:'))
    .map((entry) => entry.artifact.slice('policy:'.length));
  // A policy name is one file name under the policies root, never a path.
  for (const name of recordPolicies)
    if (!/^[^/\\.][^/\\]*$/u.test(name))
      throw new LifecycleInputError(`대응 기록 policy:${name}의 이름이 정책 문서 이름이 아님`);
  const documentPolicies = policiesRoot
    ? markdownUnder(policiesRoot.path)
        .filter((path) => posix.dirname(path) === policiesRoot.path)
        .map((path) => posix.basename(path, '.md'))
    : [];
  const names = [
    ...recordPolicies,
    ...sortedUnique(documentPolicies).filter((name) => !recordPolicies.includes(name)),
  ];
  const policyDomains =
    map || names.length
      ? names
          .map((name) =>
            artifact(`policy:${name}`, policiesRoot ? `${policiesRoot.path}/${name}.md` : null),
          )
          .filter(Boolean)
      : null;
  const crossCutting = map
    ? (map.artifacts ?? [])
        .filter((entry) => entry.artifact.startsWith('policy:') && entry.level === 'cross-cutting')
        .map((entry) => policyDomains.find((policy) => policy.id === entry.artifact))
        .filter(Boolean)
    : null;

  const architectureRoot = root('architecture');
  const decisionsRoot = root('decisions');
  const l2 = decisionsRoot
    ? markdownUnder(decisionsRoot.path)
        .map((path) => documentAt(`l2:${path}`, path))
        .filter(hasStatusHeader)
    : [];
  for (const entry of map?.artifacts ?? []) {
    if (!entry.artifact.startsWith('l2:')) continue;
    const path = entry.sources?.[0] ?? entry.artifact.slice('l2:'.length);
    if (!insideRepository(path))
      throw new LifecycleInputError(`대응 기록 ${entry.artifact}의 경로가 저장소 밖: ${path}`);
    if (!l2.some((known) => known.id === entry.artifact || known.path === path))
      l2.push(artifact(entry.artifact, path));
  }

  const pathRoot = root('path-domains');
  const pathText = pathRoot ? readFile(pathRoot.path) : null;

  return {
    config,
    prdOverview: artifact('prd-overview', productRoot ? `${productRoot.path}/overview.md` : null),
    policyDomains,
    crossCutting,
    l1: artifact('l1', architectureRoot ? `${architectureRoot.path}/README.md` : null),
    l2: l2.filter(Boolean),
    pathDomains:
      pathText === null
        ? null
        : { id: 'path-domains', path: pathRoot.path, table: parsePathDomains(pathText) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// CLI

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function repositoryReader(repo) {
  return {
    readFile(path) {
      try {
        return readFileSync(resolve(repo, path), 'utf8');
      } catch (error) {
        if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return null;
        throw new LifecycleInputError(`${path}를 읽지 못함: ${error.message}`);
      }
    },
    listFiles(directory) {
      const base = resolve(repo, directory);
      try {
        return readdirSync(base, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) =>
            posix.join(
              directory,
              relative(base, join(entry.parentPath, entry.name)).split(sep).join('/'),
            ),
          )
          .sort();
      } catch (error) {
        if (['ENOENT', 'ENOTDIR'].includes(error.code)) return [];
        throw new LifecycleInputError(`${directory} 목록을 읽지 못함: ${error.message}`);
      }
    },
  };
}

function readJson(path, label) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new LifecycleInputError(`${label}을 읽지 못함: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new LifecycleInputError(`${label} JSON parse 실패: ${error.message}`);
  }
}

export function runLifecycleState(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { repo: { type: 'string' }, input: { type: 'string' } },
    });
    if (!values.repo) throw new LifecycleInputError('--repo 없음');
    if (!isDirectory(values.repo))
      throw new LifecycleInputError(`--repo ${values.repo}: 디렉터리가 아님`);
    const definition = readJson(
      new URL('./lifecycle-definition.json', import.meta.url),
      '상태 정의',
    );
    let input = values.input
      ? readJson(values.input, `--input ${values.input}`)
      : { schema: STATE_INPUT_SCHEMA };
    if (isObject(input) && !('artifacts' in input))
      input = { ...input, artifacts: collectProjectInputs(repositoryReader(values.repo)) };
    stdout.write(`${JSON.stringify(computeLifecycleState(input, definition), null, 2)}\n`);
    return 0;
  } catch (error) {
    if (
      !(error instanceof LifecycleInputError) &&
      !String(error.code ?? '').startsWith('ERR_PARSE_ARGS')
    )
      throw error;
    stderr.write(`lifecycle-state: ${String(error.message).split('\n')[0]}\n`);
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) process.exitCode = runLifecycleState(process.argv.slice(2));
