// The Parent's delegation input. A hand-written spec names its Pass 2 sources, facts and claims by index and tags which
// facts verify which model key; this module computes the stable ids and source digests, fills each lane's routine
// model request (`defaultModelRequest`) unless the lane opts out or names its own, and composes the dispatches through
// `prepareCodexWorkflow()`. The output file is what `codex:register` reads; the computed values are advice the Parent
// still checks against the source, not a permission grant.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTaskEnvelope } from '../common/intake-policy.mjs';
import { discoverContextPack } from '../common/domain-guide-registry.mjs';
import {
  collectReviewContext,
  placeReviewContext,
  writeReviewContextExtract,
} from '../common/review-context-inputs.mjs';
import {
  loadReviewCriteriaCatalog,
  selectReviewCriteria,
} from '../common/review-criteria-selection.mjs';
import { MODEL_PROFILE_IDS, getModelProfile } from './model-profiles.mjs';
import {
  createSemanticEvidenceId,
  createSemanticFactId,
  createSemanticSourceId,
  defaultModelRequest,
} from './routing-policy.mjs';
import { isDispatchToken } from './subagent-hook-records.mjs';
import {
  createReviewDispatch,
  readRegistration,
  registerDispatch,
  registryDirectory,
} from './task-registry.mjs';
import { prepareCodexWorkflow } from './workflow-entry.mjs';

export const DELEGATION_SCHEMA = 'knu-codex-delegation/v1';
const SPEC_FIELDS = new Set(['request', 'mode', 'repositoryEvidence', 'dispatchToken', 'lanes']);
const EVIDENCE_FIELDS = new Set(['sources', 'facts', 'claims', 'inferences', 'gaps', 'confidence']);
const SOURCE_FIELDS = new Set(['path', 'locator']);
const FACT_FIELDS = new Set(['statement', 'sources', 'confidence', 'verifies']);
const CLAIM_FIELDS = new Set(['predicateId', 'outcome', 'facts', 'rationale', 'compositeCategory']);
const REQUEST_FIELDS = new Set(['profileId', 'purpose']);
const DELIVERY_FIELDS = new Set(['snapshot', 'evidencePointers', 'findings', 'failures']);
const VERIFICATION_KEYS = new Set(
  MODEL_PROFILE_IDS.flatMap((id) => getModelProfile(id).verificationKeys ?? []),
);

export function buildDelegation(spec, { root }) {
  assertRecord(spec, 'delegation spec');
  assertFields(spec, SPEC_FIELDS, 'delegation spec field');
  if (!isDispatchToken(spec.dispatchToken))
    throw new TypeError('dispatchToken must be 4-12 lowercase letters or digits other than retry');
  if (!Array.isArray(spec.lanes) || spec.lanes.length === 0)
    throw new TypeError('A delegation spec names at least one lane.');
  const envelope = buildTaskEnvelope({ request: spec.request });
  const contextPack = discoverContextPack({
    envelope,
    repositoryEvidence: spec.repositoryEvidence ?? [],
  });
  const lanes = spec.lanes.map((lane) => laneCandidate(lane, { root, envelope, contextPack }));
  const workflow = prepareCodexWorkflow({
    request: spec.request,
    mode: spec.mode,
    repositoryEvidence: spec.repositoryEvidence ?? [],
    laneCandidates: lanes.map(({ candidate }) => candidate),
    deliveryByLane: Object.fromEntries(
      lanes.flatMap(({ candidate, delivery }) => (delivery ? [[candidate.id, delivery]] : [])),
    ),
    dispatchToken: spec.dispatchToken,
    root,
  });
  const { dispatches } = workflow.dispatch;
  return {
    schema: DELEGATION_SCHEMA,
    dispatchToken: spec.dispatchToken,
    lanes: lanes.map(({ candidate, modelRequest }) => {
      const dispatch = dispatches.find(({ laneId }) => laneId === candidate.id);
      if (!dispatch)
        return { laneId: candidate.id, modelRequest, deferred: deferral(workflow, candidate.id) };
      return {
        laneId: candidate.id,
        modelRequest,
        profileId: dispatch.contract.routeRecommendation.profileId,
        role: dispatch.agentType,
        effort: dispatch.effort,
        model: dispatch.model,
      };
    }),
    dispatches,
  };
}

// Why a lane has no dispatch: the delegation deferred it (its route or selection reasons), or the dispatch of the
// recommended lanes stopped (that dispatch's reason and gaps).
function deferral(workflow, laneId) {
  const deferred = workflow.delegation.deferredLanes.find((lane) => lane.laneId === laneId);
  if (deferred) return { stage: 'delegation', reasons: deferred.reasons };
  return { stage: 'dispatch', reason: workflow.dispatch.reason, gaps: workflow.dispatch.gaps };
}

// `modelRequest` in the summary: default (filled), omitted (nothing admitted), explicit (the Parent's), astra (opt-out).
// `delivery` is the scoped packet a fresh child receives; a candidate model needs it to be spawned.
function laneCandidate(lane, { root, envelope, contextPack }) {
  assertRecord(lane, 'lane');
  if (Object.hasOwn(lane, 'pass2Evidence'))
    throw new TypeError('Unsupported lane field: pass2Evidence');
  const { evidence, modelRequest, delivery: packet, ...rest } = lane;
  const delivery = packet === undefined ? undefined : scopedDelivery(packet);
  const { pass2Evidence, tagged } = pass2From(evidence, { root, contextPack });
  const result = laneRequest({
    lane,
    rest,
    modelRequest,
    pass2Evidence,
    tagged,
    envelope,
    contextPack,
  });
  return { ...result, delivery };
}

function scopedDelivery(packet) {
  assertRecord(packet, 'lane delivery');
  assertFields(packet, DELIVERY_FIELDS, 'lane delivery field');
  return { purpose: 'task', mode: 'scoped', rationale: null, previous: null, ...packet };
}

function laneRequest({ lane, rest, modelRequest, pass2Evidence, tagged, envelope, contextPack }) {
  const candidate = { ...rest, pass2Evidence };
  if (modelRequest === false) return { candidate, modelRequest: 'astra' };
  if (modelRequest !== undefined) {
    assertRecord(modelRequest, 'lane modelRequest');
    assertFields(modelRequest, REQUEST_FIELDS, 'lane modelRequest field');
    const { verificationKeys = [] } = getModelProfile(modelRequest.profileId);
    candidate.modelRequest = {
      ...modelRequest,
      verificationFacts: Object.fromEntries(verificationKeys.map((key) => [key, tagged[key]])),
    };
    return { candidate, modelRequest: 'explicit' };
  }
  // The same route input recommendDelegation() builds for this lane.
  const request = defaultModelRequest(
    {
      pass1: {
        taskKind: lane.taskKind,
        executionShape: 'bounded-child',
        impactRisk: lane.impactRisk,
        candidateRole: null,
        requiredEvidence: lane.allowedEvidence,
        confidence: envelope.confidence,
      },
      contextPack,
      pass2Evidence,
    },
    tagged,
  );
  if (!request) return { candidate, modelRequest: 'omitted' };
  candidate.modelRequest = request;
  return { candidate, modelRequest: 'default' };
}

function pass2From(evidence, { root, contextPack }) {
  assertRecord(evidence, 'lane evidence');
  assertFields(evidence, EVIDENCE_FIELDS, 'lane evidence field');
  const sources = list(evidence.sources, 'evidence.sources').map((source, index) => {
    assertRecord(source, `source ${index}`);
    assertFields(source, SOURCE_FIELDS, 'source field');
    const current = contextPack.sources.find(({ path }) => path === source.path);
    if (!current) throw new TypeError(`Source is not in the context pack: ${source.path}`);
    const inspected = {
      path: current.path,
      locator: source.locator,
      kind: current.kind,
      observedAt: current.verifiedAt ?? current.freshness,
      contentDigest: `sha256:${createHash('sha256')
        .update(readFileSync(resolve(root, current.path)))
        .digest('hex')}`,
    };
    return { ...inspected, sourceId: createSemanticSourceId(inspected) };
  });
  const tagged = {};
  const facts = list(evidence.facts, 'evidence.facts').map((fact, index) => {
    assertRecord(fact, `fact ${index}`);
    assertFields(fact, FACT_FIELDS, 'fact field');
    const sourceIds = list(fact.sources, `fact ${index} sources`).map((sourceIndex) => {
      if (!sources[sourceIndex])
        throw new TypeError(`fact ${index} names source ${sourceIndex}, which the spec lacks`);
      return sources[sourceIndex].sourceId;
    });
    const value = { statement: fact.statement, sourceIds, confidence: fact.confidence };
    value.factId = createSemanticFactId(value);
    for (const key of list(fact.verifies ?? [], `fact ${index} verifies`)) {
      if (!VERIFICATION_KEYS.has(key)) throw new TypeError(`unknown verification key: ${key}`);
      tagged[key] ??= value.factId;
    }
    return value;
  });
  const predicateClaims = list(evidence.claims, 'evidence.claims').map((claim, index) => {
    assertRecord(claim, `claim ${index}`);
    assertFields(claim, CLAIM_FIELDS, 'claim field');
    const factIds = list(claim.facts, `claim ${index} facts`).map((factIndex) => {
      if (!facts[factIndex])
        throw new TypeError(`claim ${index} names fact ${factIndex}, which the spec lacks`);
      return facts[factIndex].factId;
    });
    const value = {
      predicateId: claim.predicateId,
      outcome: claim.outcome,
      factIds,
      semanticMatch: { matches: true, rationale: claim.rationale },
      compositeCategory: claim.compositeCategory ?? null,
    };
    value.evidenceId = createSemanticEvidenceId(value);
    return value;
  });
  return {
    pass2Evidence: {
      sources,
      facts,
      predicateClaims,
      inferences: evidence.inferences ?? [],
      gaps: evidence.gaps ?? [],
      confidence: evidence.confidence,
    },
    tagged,
  };
}

const COMMAND_OPTIONS = {
  lanes: { required: ['--spec', '--out'], optional: [] },
  review: { required: ['--lanes', '--token', '--out'], optional: ['--round'] },
  'review-run': {
    required: ['--lanes', '--token', '--out', '--paths'],
    optional: ['--round', '--session', '--criteria', '--lifecycle-draft'],
  },
};
export const REVIEW_RUN_SCHEMA = 'knu-codex-review-run/v1';

// review-run: one command for a review round. It chooses the criteria documents and collects the context inputs for
// the review target paths, registers the reviewer dispatch and writes the criteria and context records beside the
// registration. A failed choice registers nothing. The spawn arguments go to a file under --out and stdout is one
// summary line. The Parent still spawns the reviewer; review and codex:register alone work as before.
// An --out inside the repository must be a path Git ignores: the run's files would otherwise be new
// working-tree files beside the subject under review. A directory outside the repository is not in
// the tree.
function outDirectoryIssue(root, out) {
  const target = resolve(out);
  const inside = [root, realpathSync(root)]
    .map((base) => relative(base, target))
    .find((path) => !path.startsWith('..') && !isAbsolute(path));
  if (inside === undefined) return null;
  const ignored =
    inside !== '' &&
    spawnSync('git', ['-C', root, 'check-ignore', '-q', '--', inside], { timeout: 5000 }).status ===
      0;
  return ignored
    ? null
    : `out-directory-not-ignored: --out ${inside || '.'} is inside the repository and Git does not ignore it`;
}
function runReview(options, round, { root, registryRoot, env }) {
  const outIssue = outDirectoryIssue(root, options.out);
  if (outIssue)
    return {
      exitCode: 1,
      stdout: `review-run failed ${outIssue} registered=0 out=${options.out}\n`,
    };
  const sessionId = options.session ?? env.CODEX_THREAD_ID;
  const paths = options.paths.split(',').filter(Boolean);
  const review = createReviewDispatch({
    laneIds: options.lanes.split(','),
    dispatchToken: options.token,
    round,
  });
  // Where the registry keeps this session's records; the extracts are named by repository-relative paths.
  const directory = registryDirectory(registryRoot, sessionId);
  const record = (suffix) => `${relative(registryRoot, directory)}/${review.reviewId}${suffix}`;
  mkdirSync(options.out, { recursive: true });
  const outFile = join(options.out, 'review-run.json');
  let criteria;
  let collected;
  let context;
  let registration;
  // The choice and the inputs come first and the registration last, so a refusal of any of them
  // leaves nothing registered.
  try {
    criteria = selectReviewCriteria({
      paths,
      catalog: loadReviewCriteriaCatalog(root),
      ...(options.criteria === undefined ? {} : { criteria: options.criteria.split(',') }),
    });
    collected = collectReviewContext({ root, paths, lifecycleDraft: options['lifecycle-draft'] });
    context = placeReviewContext(collected, {
      'binding-values': record('.binding.md'),
      'lifecycle-draft': record('.lifecycle.md'),
    });
    registration = registerDispatch({ root: registryRoot, sessionId, dispatch: review });
  } catch (error) {
    writeJson(outFile, { schema: REVIEW_RUN_SCHEMA, ok: false, error: error.message });
    return {
      exitCode: 1,
      stdout: `review-run failed ${error.message.split('\n')[0]} registered=0 out=${outFile}\n`,
    };
  }
  const { taskName, spawnArguments } = registration;
  const { digest } = readRegistration({ root: registryRoot, sessionId, taskName });
  writeJson(join(registryRoot, record('.criteria.json')), criteria);
  writeJson(join(registryRoot, record('.context.json')), context);
  for (const input of context.inputs)
    if (Object.hasOwn(collected.extracts, input.kind))
      writeReviewContextExtract(registryRoot, input.path, collected.extracts[input.kind]);
  writeJson(join(options.out, 'review.json'), review);
  writeJson(join(options.out, 'spawn-arguments.json'), spawnArguments);
  writeJson(outFile, {
    schema: REVIEW_RUN_SCHEMA,
    ok: true,
    sessionId,
    taskName,
    reviewId: review.reviewId,
    digest,
    round,
    reviewOf: review.reviewOf,
    spawnArguments,
    criteria: {
      override: criteria.override,
      documents: criteria.documents.map((document) => document.id),
      documentCount: criteria.documentCount,
      itemCount: criteria.itemCount,
      unmatchedPaths: criteria.unmatchedPaths,
    },
    criteriaFile: record('.criteria.json'),
    contextInputs: context.inputs.map((input) => input.path),
    contextFile: record('.context.json'),
  });
  return {
    exitCode: 0,
    stdout: `review-run ok task=${taskName} review=${review.reviewId} criteria=${criteria.documentCount} out=${outFile}\n`,
  };
}

export function runDelegateCommand(argv, { root, registryRoot = root, env = process.env }) {
  const [command, ...rest] = argv.filter((arg, index) => !(arg === '--' && index <= 1));
  if (!Object.hasOwn(COMMAND_OPTIONS, command))
    throw new TypeError('expected lanes, review or review-run');
  const keys = COMMAND_OPTIONS[command];
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (![...keys.required, ...keys.optional].includes(key) || rest[index + 1] === undefined)
      throw new TypeError(`unexpected ${command} argument: ${key}`);
    options[key.slice(2)] = rest[(index += 1)];
  }
  for (const key of keys.required)
    if (options[key.slice(2)] === undefined) throw new TypeError(`${key} is required`);
  if (command === 'lanes') {
    const delegation = buildDelegation(JSON.parse(readFileSync(options.spec, 'utf8')), { root });
    writeJson(options.out, delegation);
    return {
      exitCode: 0,
      stdout: `${JSON.stringify({ out: options.out, lanes: delegation.lanes }, null, 2)}\n`,
    };
  }
  const round = options.round === undefined ? 1 : Number(options.round);
  if (!Number.isInteger(round) || round < 1) throw new TypeError('--round is a positive integer');
  if (command === 'review-run') return runReview(options, round, { root, registryRoot, env });
  const review = createReviewDispatch({
    laneIds: options.lanes.split(','),
    dispatchToken: options.token,
    round,
  });
  writeJson(options.out, review);
  return {
    exitCode: 0,
    stdout: `${JSON.stringify({ out: options.out, spawnArguments: review.spawnArguments }, null, 2)}\n`,
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function list(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
}

function assertFields(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new TypeError(`Unsupported ${label}: ${unknown.join(', ')}`);
}

// Compare real paths: module URLs resolve symlinks, argv does not.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { exitCode, stdout } = runDelegateCommand(process.argv.slice(2), {
      root: resolve(import.meta.dirname, '../../..'),
    });
    process.stdout.write(stdout);
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
