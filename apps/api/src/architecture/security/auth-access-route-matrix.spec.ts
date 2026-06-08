import { RequestMethod } from '@nestjs/common';
import { AuthController } from '../../auth/auth.controller.js';
import { AUTH_CAPABILITIES } from '../../auth/access/auth-capability.js';
import {
  AUTH_ACCESS_METADATA_KEY,
  AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
} from '../../auth/access/auth-access.decorator.js';
import { ChatController } from '../../chat/chat.controller.js';
import { BlockController } from '../../social-safety/blocks/block.controller.js';
import { BookmarkController } from '../../social-safety/bookmarks/bookmark.controller.js';
import { DormitoriesController } from '../../dormitories/dormitories.controller.js';
import { HealthController } from '../../health/health.controller.js';
import { MatchesController } from '../../matches/matches.controller.js';
import { NotificationsController } from '../../notifications/notifications.controller.js';
import { ProfilesController } from '../../profiles/profiles.controller.js';
import { RoommateSearchController } from '../../profiles/roommate-search.controller.js';
import { SeasonsController } from '../../seasons/seasons.controller.js';
import { SeasonsOperationsController } from '../../seasons/operations/seasons-operations.controller.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from '../../season-participants/current-season-participation.controller.js';
import { UsersController } from '../../users/users.controller.js';

const NEST_CONTROLLER_PATH_METADATA = 'path';
const NEST_ROUTE_PATH_METADATA = 'path';
const NEST_ROUTE_METHOD_METADATA = 'method';

type AccessMode = 'public' | 'optional' | 'protected';

interface ExpectedRoute {
  controller: new (...args: never[]) => unknown;
  handler: string;
  method: RequestMethod;
  path: string;
  access: AccessMode;
  capabilities?: readonly string[];
}

const expectedRoutes: ExpectedRoute[] = [
  {
    controller: AuthController,
    handler: 'sendSignupCode',
    method: RequestMethod.POST,
    path: 'auth/send-signup-code',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'sendResetCode',
    method: RequestMethod.POST,
    path: 'auth/send-reset-code',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'verifyEmailCode',
    method: RequestMethod.POST,
    path: 'auth/verify-email-code',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'verifyResetCode',
    method: RequestMethod.POST,
    path: 'auth/verify-reset-code',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'session',
    method: RequestMethod.GET,
    path: 'auth/session',
    access: 'optional',
  },
  {
    controller: AuthController,
    handler: 'validateSignupDraft',
    method: RequestMethod.POST,
    path: 'auth/validate-signup-draft',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'signup',
    method: RequestMethod.POST,
    path: 'auth/signup',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'login',
    method: RequestMethod.POST,
    path: 'auth/login',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'resetPassword',
    method: RequestMethod.POST,
    path: 'auth/reset-password',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'changePassword',
    method: RequestMethod.POST,
    path: 'auth/change-password',
    access: 'protected',
    capabilities: [AUTH_CAPABILITIES.AUTH_PASSWORD_CHANGE_SELF],
  },
  {
    controller: AuthController,
    handler: 'renewSession',
    method: RequestMethod.POST,
    path: 'auth/renew-session',
    access: 'public',
  },
  {
    controller: AuthController,
    handler: 'logout',
    method: RequestMethod.POST,
    path: 'auth/logout',
    access: 'optional',
  },
  {
    controller: UsersController,
    handler: 'getCurrentUser',
    method: RequestMethod.GET,
    path: 'api/users/me',
    access: 'protected',
    capabilities: [AUTH_CAPABILITIES.USER_READ_SELF],
  },
  {
    controller: UsersController,
    handler: 'updateCurrentUser',
    method: RequestMethod.PATCH,
    path: 'api/users/me',
    access: 'protected',
    capabilities: [AUTH_CAPABILITIES.USER_UPDATE_SELF],
  },
  {
    controller: UsersController,
    handler: 'dismissCurrentUserOnboardingNotice',
    method: RequestMethod.PATCH,
    path: 'api/users/me/onboarding',
    access: 'protected',
    capabilities: [AUTH_CAPABILITIES.USER_UPDATE_SELF],
  },
  {
    controller: UsersController,
    handler: 'requestAccountDeletion',
    method: RequestMethod.POST,
    path: 'api/users/me/delete',
    access: 'protected',
    capabilities: [AUTH_CAPABILITIES.USER_UPDATE_SELF],
  },
  {
    controller: HealthController,
    handler: 'getLiveness',
    method: RequestMethod.GET,
    path: 'health',
    access: 'public',
  },
  {
    controller: HealthController,
    handler: 'getReadiness',
    method: RequestMethod.GET,
    path: 'health/ready',
    access: 'public',
  },
  {
    controller: HealthController,
    handler: 'getRealtimeOperations',
    method: RequestMethod.GET,
    path: 'health/realtime',
    access: 'protected',
    capabilities: ['admin:operations:health:read'],
  },
  {
    controller: HealthController,
    handler: 'getAuthOperations',
    method: RequestMethod.GET,
    path: 'health/auth',
    access: 'protected',
    capabilities: ['admin:operations:health:read'],
  },
  {
    controller: SeasonsController,
    handler: 'getCurrentSeason',
    method: RequestMethod.GET,
    path: 'api/seasons/current',
    access: 'public',
  },
  {
    controller: SeasonsOperationsController,
    handler: 'updateSchedule',
    method: RequestMethod.PATCH,
    path: 'api/campuses/:campusCode/seasons/:seasonId/schedule',
    access: 'protected',
    capabilities: ['admin:season:operations:write'],
  },
  {
    controller: SeasonsOperationsController,
    handler: 'updateOverride',
    method: RequestMethod.PATCH,
    path: 'api/campuses/:campusCode/seasons/:seasonId/override',
    access: 'protected',
    capabilities: ['admin:season:operations:write'],
  },
  {
    controller: SeasonsOperationsController,
    handler: 'clearOverride',
    method: RequestMethod.DELETE,
    path: 'api/campuses/:campusCode/seasons/:seasonId/override',
    access: 'protected',
    capabilities: ['admin:season:operations:write'],
  },
  {
    controller: DormitoriesController,
    handler: 'getDormitories',
    method: RequestMethod.GET,
    path: 'api/dormitories',
    access: 'public',
  },
  {
    controller: DormitoriesController,
    handler: 'getDormitoryById',
    method: RequestMethod.GET,
    path: 'api/dormitories/:id',
    access: 'public',
  },
  {
    controller: DormitoriesController,
    handler: 'getDormitoryGuide',
    method: RequestMethod.GET,
    path: 'api/dormitories/:id/guide',
    access: 'public',
  },
  {
    controller: CurrentSeasonProfileController,
    handler: 'getCurrentSeasonProfile',
    method: RequestMethod.GET,
    path: 'api/seasons/current/profile',
    access: 'protected',
  },
  {
    controller: CurrentSeasonProfileController,
    handler: 'createOrUpdateSeasonProfileDraft',
    method: RequestMethod.PUT,
    path: 'api/seasons/current/profile',
    access: 'protected',
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'listSelectableDormitories',
    method: RequestMethod.GET,
    path: 'api/seasons/current/participation/selectable-dormitories',
    access: 'protected',
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'createOrUpdateDormitorySelection',
    method: RequestMethod.POST,
    path: 'api/seasons/current/participation/dormitory-selection',
    access: 'protected',
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'finalizeSeasonRegistration',
    method: RequestMethod.POST,
    path: 'api/seasons/current/participation/registration',
    access: 'protected',
  },
  {
    controller: CurrentSeasonParticipationController,
    handler: 'deregister',
    method: RequestMethod.POST,
    path: 'api/seasons/current/participation/deregister',
    access: 'protected',
  },
  {
    controller: RoommateSearchController,
    handler: 'getManifest',
    method: RequestMethod.GET,
    path: 'api/roommate-search/manifest',
    access: 'protected',
  },
  {
    controller: RoommateSearchController,
    handler: 'search',
    method: RequestMethod.GET,
    path: 'api/roommate-search',
    access: 'protected',
  },
  {
    controller: ProfilesController,
    handler: 'getProfileByUserId',
    method: RequestMethod.GET,
    path: 'api/profiles/:userId',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'getRequests',
    method: RequestMethod.GET,
    path: 'api/matches/requests',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'createRequest',
    method: RequestMethod.POST,
    path: 'api/matches/requests',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'acceptRequest',
    method: RequestMethod.POST,
    path: 'api/matches/requests/:id/accept',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'rejectRequest',
    method: RequestMethod.POST,
    path: 'api/matches/requests/:id/reject',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'cancelRequest',
    method: RequestMethod.POST,
    path: 'api/matches/requests/:id/cancel',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'getActiveMatch',
    method: RequestMethod.GET,
    path: 'api/matches/active',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'getHistory',
    method: RequestMethod.GET,
    path: 'api/matches/history',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'getHistoryCounterpartProfile',
    method: RequestMethod.GET,
    path: 'api/matches/history/entries/:entryId/counterpart-profile',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'requestUnmatch',
    method: RequestMethod.POST,
    path: 'api/matches/active/:id/unmatch-request',
    access: 'protected',
  },
  {
    controller: MatchesController,
    handler: 'cancelUnmatchRequest',
    method: RequestMethod.POST,
    path: 'api/matches/active/:id/unmatch-request/cancel',
    access: 'protected',
  },
  {
    controller: BookmarkController,
    handler: 'list',
    method: RequestMethod.GET,
    path: 'api/bookmarks',
    access: 'protected',
  },
  {
    controller: BookmarkController,
    handler: 'create',
    method: RequestMethod.POST,
    path: 'api/bookmarks/:targetUserId',
    access: 'protected',
  },
  {
    controller: BookmarkController,
    handler: 'delete',
    method: RequestMethod.DELETE,
    path: 'api/bookmarks/:targetUserId',
    access: 'protected',
  },
  {
    controller: BlockController,
    handler: 'list',
    method: RequestMethod.GET,
    path: 'api/blocks',
    access: 'protected',
  },
  {
    controller: BlockController,
    handler: 'create',
    method: RequestMethod.POST,
    path: 'api/blocks/:targetUserId',
    access: 'protected',
  },
  {
    controller: BlockController,
    handler: 'delete',
    method: RequestMethod.DELETE,
    path: 'api/blocks/:targetUserId',
    access: 'protected',
  },
  {
    controller: NotificationsController,
    handler: 'listNotifications',
    method: RequestMethod.GET,
    path: 'api/notifications',
    access: 'protected',
  },
  {
    controller: NotificationsController,
    handler: 'getUnreadCount',
    method: RequestMethod.GET,
    path: 'api/notifications/unread-count',
    access: 'protected',
  },
  {
    controller: NotificationsController,
    handler: 'markRead',
    method: RequestMethod.POST,
    path: 'api/notifications/:notificationId/read',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'getThreads',
    method: RequestMethod.GET,
    path: 'api/chat/threads',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'getConversationStats',
    method: RequestMethod.GET,
    path: 'api/chat/conversation-stats',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'getThreadEntry',
    method: RequestMethod.GET,
    path: 'api/chat/threads/with/:targetUserId',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'getThreadDetail',
    method: RequestMethod.GET,
    path: 'api/chat/threads/:threadId',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'replayRealtimeEvents',
    method: RequestMethod.GET,
    path: 'api/chat/realtime/replay',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'issueRealtimeTicket',
    method: RequestMethod.POST,
    path: 'api/chat/realtime/tickets',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'leaveThread',
    method: RequestMethod.POST,
    path: 'api/chat/threads/:threadId/leave',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'updateReadMarker',
    method: RequestMethod.POST,
    path: 'api/chat/threads/:threadId/read-marker',
    access: 'protected',
  },
  {
    controller: ChatController,
    handler: 'sendMessage',
    method: RequestMethod.POST,
    path: 'api/chat/messages',
    access: 'protected',
  },
];

function normalizePath(basePath: string, routePath: string | string[] | undefined) {
  const route = Array.isArray(routePath) ? routePath.join('|') : (routePath ?? '');
  return [basePath, route]
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0)
    .join('/')
    .replace(/\/+/g, '/');
}

function getActualRoutes(controllers: Array<ExpectedRoute['controller']>) {
  return controllers.flatMap((controller) => {
    const basePath = Reflect.getMetadata(NEST_CONTROLLER_PATH_METADATA, controller) as string;
    const prototype = getControllerPrototype(controller);
    return Object.getOwnPropertyNames(prototype)
      .filter((handler) => handler !== 'constructor')
      .map((handler) => {
        const methodRef = prototype[handler];
        if (!methodRef) {
          return null;
        }
        const method = Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, methodRef) as
          | RequestMethod
          | undefined;
        const path = Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, methodRef) as
          | string
          | string[]
          | undefined;

        if (method === undefined) {
          return null;
        }

        return {
          controller,
          handler,
          method,
          path: normalizePath(basePath, path),
        };
      })
      .filter((route): route is NonNullable<typeof route> => route !== null);
  });
}

function resolveAccess(
  controller: ExpectedRoute['controller'],
  handler: string,
): AccessMode | null {
  const methodRef = getRouteHandler(controller, handler);
  return (
    (Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, methodRef) as AccessMode | undefined) ??
    (Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, controller) as AccessMode | undefined) ??
    null
  );
}

function resolveCapabilities(controller: ExpectedRoute['controller'], handler: string) {
  const methodRef = getRouteHandler(controller, handler);
  return [
    ...((Reflect.getMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, controller) as
      | string[]
      | undefined) ?? []),
    ...((Reflect.getMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, methodRef) as
      | string[]
      | undefined) ?? []),
  ];
}

function getControllerPrototype(controller: ExpectedRoute['controller']) {
  return controller.prototype as unknown as Record<string, object | undefined>;
}

function getRouteHandler(controller: ExpectedRoute['controller'], handler: string): object {
  const methodRef = getControllerPrototype(controller)[handler];
  if (!methodRef) {
    throw new Error(`Expected route handler ${controller.name}.${handler}`);
  }
  return methodRef;
}

describe('Auth access route matrix', () => {
  it('모든 HTTP route는 public/optional/protected matrix에 고정된다', () => {
    const controllers = [...new Set(expectedRoutes.map((route) => route.controller))];
    const actualRoutes = getActualRoutes(controllers);

    expect(
      actualRoutes.map((route) => `${route.method} ${route.path}#${route.handler}`).sort(),
    ).toEqual(
      expectedRoutes.map((route) => `${route.method} ${route.path}#${route.handler}`).sort(),
    );

    for (const route of expectedRoutes) {
      expect(resolveAccess(route.controller, route.handler)).toBe(route.access);
      expect(resolveCapabilities(route.controller, route.handler)).toEqual(
        route.capabilities ?? [],
      );
    }
  });
});
