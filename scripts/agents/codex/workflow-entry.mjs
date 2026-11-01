import { pathToFileURL } from 'node:url';
import { buildTaskEnvelope } from '../common/intake-policy.mjs';
import { discoverContextPack } from '../common/domain-guide-registry.mjs';
import { assessPlanReadiness } from '../common/plan-readiness-policy.mjs';
import { resolveWorkflowEntry } from '../common/workflow-entry.mjs';
import { readPlan, assessPlanContinuation } from '../common/plan-store.mjs';
import {
  validateBoundedLanes,
  validateFanIn,
  validateAdapterReview,
} from '../common/adapter-contract.mjs';
import { recommendDelegation } from './child-task-contract.mjs';
import {
  createDispatchRecommendation,
  laneCompletionExpectation,
} from './orchestration-policy.mjs';
import {
  COMPLETION_AUTHORITY,
  checkLaneCompletion,
  checkReviewCompletion,
  reviewId,
  reviewTasks,
} from './subagent-hook-records.mjs';

const WORKFLOW_INPUTS = new Set([
  'request',
  'mode',
  'repositoryEvidence',
  'laneCandidates',
  'deliveryByLane',
  'concurrencyLimit',
  'ownerDirectedChildLimit',
  'dispatchToken',
  'currentSnapshot',
  'adapterIdentity',
  'assignments',
  'directAssignment',
  'root',
  'planPath',
  'continuation',
  'planReadiness',
  'reviewDisposition',
]);

// Actual deterministic Codex composition, not a native scheduler or permission grant.
// A caller supplies current evidence; the Lead verifies its authenticity before host use.
export function prepareCodexWorkflow(input = {}) {
  for (const key of Object.keys(input ?? {}))
    if (!WORKFLOW_INPUTS.has(key)) throw new TypeError(`Unsupported workflow input: ${key}`);
  return composeCodexWorkflow(input ?? {});
}

function composeCodexWorkflow({
  request,
  mode,
  repositoryEvidence = [],
  laneCandidates = [],
  deliveryByLane = {},
  concurrencyLimit,
  ownerDirectedChildLimit,
  dispatchToken,
  currentSnapshot,
  adapterIdentity,
  assignments = {},
  directAssignment,
  root = process.cwd(),
  planPath,
  continuation,
  planReadiness,
  reviewDisposition,
}) {
  const envelope = buildTaskEnvelope({ request });
  const contextPack = discoverContextPack({ envelope, repositoryEvidence });
  const route = resolveWorkflowEntry({ envelope, contextPack, host: 'codex', mode });
  if (planPath && mode !== 'resume') throw new TypeError('plan selection requires resume');
  if (planReadiness !== undefined && envelope.intent !== 'plan')
    throw new TypeError('readiness requires plan intent');
  const plan = planPath ? readPlan(root, planPath) : null;
  const continuationResult = planPath
    ? assessPlanContinuation({
        ...continuation,
        plan,
        mode,
        explicitlySelected: true,
      })
    : null;
  const delegation = recommendDelegation({
    envelope,
    contextPack,
    laneCandidates,
    deliveryByLane,
    ...(ownerDirectedChildLimit === undefined ? {} : { ownerDirectedChildLimit }),
  });
  const dispatch = createDispatchRecommendation({
    delegation,
    ...(concurrencyLimit === undefined ? {} : { concurrencyLimit }),
    ...(dispatchToken === undefined ? {} : { dispatchToken }),
  });
  const children = delegation.recommendedChildren;
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments))
    throw new TypeError('assignments must be keyed by selected lane');
  if (Object.keys(assignments).some((id) => !children.some((child) => child.laneId === id)))
    throw new TypeError('assignment for unselected child');
  if (children.length && directAssignment)
    throw new TypeError('direct and child ownership cannot be mixed');
  if (
    directAssignment &&
    Object.keys(directAssignment).some(
      (key) => !['owner', 'dispatchId', 'acceptance', 'writeOwnership'].includes(key),
    )
  )
    throw new TypeError('unknown direct assignment field');
  const lanes = children.length
    ? children.flatMap((child) => {
        const assignment = assignments[child.laneId];
        if (!assignment) return [];
        if (Object.keys(assignment).some((key) => !['owner', 'dispatchId'].includes(key)))
          throw new TypeError('child assignment cannot override contract scope');
        return [
          {
            id: child.laneId,
            dispatchId: assignment.dispatchId,
            owner: assignment.owner,
            objective: child.objective,
            acceptance: child.verification,
            dependencies: [],
            writeOwnership: child.boundary.writeOwnership,
            sourceSnapshot: currentSnapshot,
          },
        ];
      })
    : directAssignment
      ? [
          {
            id: envelope.requestId,
            dispatchId: directAssignment.dispatchId,
            owner: directAssignment.owner,
            objective: request,
            acceptance: directAssignment.acceptance,
            dependencies: [],
            writeOwnership: directAssignment.writeOwnership,
            sourceSnapshot: currentSnapshot,
          },
        ]
      : [];
  const laneValidation = lanes.length
    ? validateBoundedLanes({ envelope, contextPack, lanes, currentSnapshot })
    : null;
  if (laneValidation && !laneValidation.valid)
    throw new TypeError(laneValidation.errors.join('; '));
  if (
    reviewDisposition !== undefined &&
    (!reviewDisposition ||
      typeof reviewDisposition.required !== 'boolean' ||
      typeof reviewDisposition.reason !== 'string' ||
      !reviewDisposition.reason.trim() ||
      Object.keys(reviewDisposition).some((key) => !['required', 'reason'].includes(key)))
  )
    throw new TypeError('review disposition requires explicit required and reason');
  // Semantic risk remains a Lead judgement, not an intent/keyword heuristic.
  const bindingComplete =
    lanes.length > 0 && (!children.length || lanes.length === children.length);
  const gaps = [
    ...(reviewDisposition === undefined ? ['independent-review-disposition-required'] : []),
    ...(!bindingComplete ? ['current-snapshot-and-explicit-assignment-required'] : []),
    ...(continuationResult?.decision === 'needs-review' ? continuationResult.reasons : []),
  ];
  return {
    schemaVersion: 1,
    host: 'codex',
    verificationClass: 'deterministic-static',
    dispatchAuthorized: false,
    runtimeQualified: false,
    envelope,
    contextPack,
    route,
    delegation,
    dispatch,
    plan,
    continuation: continuationResult,
    planReadiness: planReadiness === undefined ? null : assessPlanReadiness(planReadiness),
    currentSnapshot,
    adapterIdentity,
    lanes,
    laneValidation,
    gaps,
    reviewDisposition: reviewDisposition ?? null,
    requiresIndependentReview: reviewDisposition?.required === true,
    liveChecks: [
      'current-source-and-user-authority',
      'host-role-model-permission-and-lifecycle',
      'required-codex-astra-qa',
    ],
  };
}

// Recompute the contract from original request/evidence, never trust an edited prepared object. A complete child lane
// also needs its own hook records (hookObservation = readHookRecords() result) and the acceptance record of its
// accepted child (acceptances); the Parent direct lane has no child to observe. A lane that ran its recovery retry
// passes its decision, which names the retry child to check. With hook records the QA must also come from accepted
// reviewer children of this dispatch.
export function validateCodexWorkflowResults(
  input,
  { results = [], review, hookObservation, recoveryDecisions = [], acceptances = [] } = {},
) {
  const workflow = prepareCodexWorkflow(input);
  const fanIn = validateFanIn({
    envelope: workflow.envelope,
    contextPack: workflow.contextPack,
    lanes: workflow.lanes,
    currentSnapshot: workflow.currentSnapshot,
    hostId: 'codex',
    adapterIdentity: workflow.adapterIdentity,
    results,
  });
  const errors = [...workflow.gaps, ...fanIn.errors];
  const children = new Map(
    workflow.delegation.recommendedChildren.map((contract) => [contract.laneId, contract]),
  );
  if (!Array.isArray(recoveryDecisions)) throw new TypeError('recoveryDecisions must be an array.');
  if (!Array.isArray(acceptances)) throw new TypeError('acceptances must be an array.');
  const recoveries = new Map();
  for (const decision of recoveryDecisions) {
    // Every decision is recomputed against its lane contract (an unknown lane is refused), not only the ones a
    // complete result uses.
    laneCompletionExpectation({
      contract: children.get(decision?.laneId),
      recoveryDecision: decision ?? null,
    });
    if (recoveries.has(decision.laneId))
      throw new TypeError('recovery laneId values must be unique.');
    recoveries.set(decision.laneId, decision);
  }
  for (const result of Array.isArray(results) ? results : []) {
    const action = recoveries.get(result?.laneId)?.action;
    if (result?.status === 'complete' && action !== undefined && action !== 'none')
      throw new TypeError('A completed child result cannot have a pending or terminal recovery.');
  }
  const completionChecks = (Array.isArray(results) ? results : [])
    .filter(
      (result) =>
        result?.status === 'complete' &&
        children.has(result.laneId) &&
        workflow.lanes.some(({ id }) => id === result.laneId),
    )
    .map(({ laneId }) => ({
      laneId,
      ...checkLaneCompletion({
        observation: hookObservation,
        laneId,
        dispatchToken: input?.dispatchToken,
        acceptances,
        ...laneCompletionExpectation({
          contract: children.get(laneId),
          ...(recoveries.has(laneId) ? { recoveryDecision: recoveries.get(laneId) } : {}),
        }),
      }),
    }));
  for (const { laneId, accepted, reason } of completionChecks)
    if (!accepted) errors.push(`child lane ${laneId} completion refused: ${reason}`);
  let qa = null;
  if (review) {
    if (
      review.packet?.objective !== input.request ||
      !Array.isArray(review.builderIds) ||
      workflow.lanes.some((lane) => !review.builderIds.includes(lane.owner))
    )
      errors.push('QA must bind current objective and assigned builders');
    // The exchange snapshot comes from this task, not a caller-selected alternative.
    qa = validateAdapterReview({ ...review, currentSnapshot: workflow.currentSnapshot });
    errors.push(...qa.errors);
    const covers = (scope, path) =>
      typeof scope === 'string' && (path === scope || path.startsWith(`${scope}/`));
    const coverage = review.result?.acceptanceCoverage ?? [];
    const readPaths = review.packet?.boundaries?.allowedReadPaths ?? [];
    const requiredPaths = [
      ...workflow.lanes.flatMap((lane) => lane.writeOwnership),
      ...workflow.delegation.recommendedChildren.flatMap((child) => child.boundary.readScope),
    ];
    if (
      workflow.lanes.some((lane) =>
        lane.acceptance.some(
          (criterion) =>
            !Array.isArray(coverage) ||
            !coverage.some((item) => item?.criterion === criterion && item.gap === null),
        ),
      )
    )
      errors.push('QA must cover every current lane acceptance criterion');
    if (
      !Array.isArray(readPaths) ||
      requiredPaths.some((path) => !readPaths.some((scope) => covers(scope, path)))
    )
      errors.push('QA read scope must cover current assigned scope');
    if (review.result?.status !== 'complete' || review.result?.verdict !== 'PASS')
      errors.push('QA exchange does not report complete PASS');
    if (hookObservation !== undefined)
      errors.push(
        ...reviewerErrors({
          observation: hookObservation,
          dispatchToken: input?.dispatchToken,
          acceptances,
          laneIds: workflow.lanes.map(({ id }) => id),
          dispatchId: review.result?.dispatchId,
        }),
      );
  } else if (workflow.requiresIndependentReview) errors.push('independent QA exchange required');
  return {
    valid: errors.length === 0,
    errors,
    fanIn,
    completionAuthority: COMPLETION_AUTHORITY,
    completionChecks,
    qa,
    verificationClass: 'static-contract',
    dispatchAuthorized: false,
    runtimeQualified: false,
    liveChecks: [...workflow.liveChecks, 'parent-reproduces-findings-and-verifies-actual-changes'],
  };
}

// Every reviewer task under this dispatch token (allowed, started or claimed by a review seal) is accepted and not
// resumed, so a sibling round cannot be left out, and each runs the review role on its review profile model under a seal
// that spells its task name. The reported result comes from the latest round the task names spell, whose registration
// covers every current lane.
function reviewerErrors({ observation, dispatchToken, acceptances, laneIds, dispatchId }) {
  const reviews = reviewTasks(observation, dispatchToken);
  if (reviews.length === 0)
    return ['QA review has no registered reviewer spawn under this dispatch token'];
  const errors = [];
  for (const { taskName, round } of reviews) {
    if (round === null) {
      errors.push(`QA reviewer ${taskName} completion refused: registration-invalid`);
      continue;
    }
    const { accepted, reason } = checkReviewCompletion({
      observation,
      dispatchToken,
      round,
      acceptances,
    });
    if (!accepted) errors.push(`QA reviewer ${taskName} completion refused: ${reason}`);
  }
  const latest = reviews
    .filter(({ round }) => round !== null)
    .reduce((last, review) => (last === null || review.round > last.round ? review : last), null);
  if (latest === null || dispatchId !== reviewId(dispatchToken, latest.round)) {
    errors.push('QA result must come from the latest registered review round');
    if (latest === null) return errors;
  }
  const reviewOf = latest.registration?.reviewOf;
  if (!Array.isArray(reviewOf) || laneIds.some((id) => !reviewOf.includes(id)))
    errors.push('QA review registration must cover every current lane');
  return errors;
}

function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--json' || (key === '--' && i === 0)) continue;
    if (
      !['--request', '--mode', '--plan'].includes(key) ||
      options[key] ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new TypeError('expected --request TEXT --mode fresh|resume [--plan PATH] [--json]');
    options[key] = args[++i];
  }
  if (!options['--request']) throw new TypeError('request required');
  const workflow = prepareCodexWorkflow({
    request: options['--request'],
    mode: options['--mode'],
    planPath: options['--plan'],
  });
  process.stdout.write(JSON.stringify(workflow, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
