import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from '../season-participants/current-season-participation.controller.js';
import {
  DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY,
  type CurrentSeasonParticipantContextRequirement,
} from '../common/domain-context/domain-context.decorator.js';
import { CurrentSeasonParticipantContextGuard } from '../season-participants/current-season-participant-context.guard.js';

const NEST_GUARDS_METADATA = '__guards__';

interface ExpectedDomainContextRoute {
  controller: new (...args: never[]) => unknown;
  handler: string;
  path: string;
  domainContexts: readonly CurrentSeasonParticipantContextRequirement[];
  guards?: readonly unknown[];
}

const expectedPhase51P1Routes: ExpectedDomainContextRoute[] = [
  {
    controller: CurrentSeasonProfileController,
    handler: 'createOrUpdateSeasonProfileDraft',
    path: 'PUT /api/seasons/current/profile',
    domainContexts: [
      {
        kind: 'current-season-participant',
        mode: 'ensure',
        source: 'actor-campus',
      },
    ],
    guards: [CurrentSeasonParticipantContextGuard],
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'createOrUpdateDormitorySelection',
    path: 'POST /api/seasons/current/participation/dormitory-selection',
    domainContexts: [
      {
        kind: 'current-season-participant',
        mode: 'ensure',
        source: 'actor-campus',
      },
    ],
    guards: [CurrentSeasonParticipantContextGuard],
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'finalizeSeasonRegistration',
    path: 'POST /api/seasons/current/participation/registration',
    domainContexts: [
      {
        kind: 'current-season-participant',
        mode: 'ensure',
        source: 'actor-campus',
      },
    ],
    guards: [CurrentSeasonParticipantContextGuard],
  },
];

const expectedPhase51ExcludedRoutes: ExpectedDomainContextRoute[] = [
  {
    controller: CurrentSeasonProfileController,
    handler: 'getCurrentSeasonProfile',
    path: 'GET /api/seasons/current/profile',
    domainContexts: [],
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'listSelectableDormitories',
    path: 'GET /api/seasons/current/participation/selectable-dormitories',
    domainContexts: [],
  },
];

function resolveDomainContexts(
  controller: ExpectedDomainContextRoute['controller'],
  handler: string,
) {
  const methodRef = getRouteHandler(controller, handler);
  return [
    ...readDomainContexts(controller),
    ...readDomainContexts(methodRef),
  ] satisfies CurrentSeasonParticipantContextRequirement[];
}

function readDomainContexts(target: object): CurrentSeasonParticipantContextRequirement[] {
  return (
    (Reflect.getMetadata(DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY, target) as
      | CurrentSeasonParticipantContextRequirement[]
      | undefined) ?? []
  );
}

function getRouteHandler(
  controller: ExpectedDomainContextRoute['controller'],
  handler: string,
): object {
  const methodRef = (controller.prototype as Record<string, object | undefined>)[handler];
  if (!methodRef) {
    throw new Error(`Expected route handler ${controller.name}.${handler}`);
  }
  return methodRef;
}

describe('Domain context route metadata inventory', () => {
  it.each(expectedPhase51P1Routes)(
    '$path#$handler는 auth axis와 별도로 current-season-participant context를 요구한다',
    ({ controller, handler, domainContexts }) => {
      expect(resolveDomainContexts(controller, handler)).toEqual(domainContexts);
    },
  );

  it.each(expectedPhase51P1Routes)(
    '$path#$handler는 domain context guard도 route method에 직접 적용한다',
    ({ controller, handler, guards }) => {
      expect(resolveRouteGuards(controller, handler)).toEqual(guards);
    },
  );

  it.each(expectedPhase51ExcludedRoutes)(
    '$path#$handler는 no-row 정상 응답을 위해 participant context guard를 적용하지 않는다',
    ({ controller, handler, domainContexts }) => {
      expect(resolveDomainContexts(controller, handler)).toEqual(domainContexts);
      expect(resolveRouteGuards(controller, handler)).toEqual([]);
    },
  );
});

function resolveRouteGuards(controller: ExpectedDomainContextRoute['controller'], handler: string) {
  const methodRef = getRouteHandler(controller, handler);
  return (Reflect.getMetadata(NEST_GUARDS_METADATA, methodRef) as unknown[] | undefined) ?? [];
}
