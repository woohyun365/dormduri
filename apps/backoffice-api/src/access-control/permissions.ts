import { AdminRole } from '@repo/database/enums';
import { backofficePermissionSchema, type BackofficePermission } from '@repo/shared/backoffice';

/**
 * Fine-grained permissions are code constants; the database stores only which role an account
 * holds (README §4, operator-access.md OA-R9·OA-R11). Names follow `admin:<resource>:<action>`.
 */
export const BACKOFFICE_PERMISSIONS: readonly BackofficePermission[] =
  backofficePermissionSchema.options;

/**
 * Restricted permissions (RRPD retained vault read, export and hold, #236). They exist as names so
 * a later RRPD plan can refer to them, but no role holds them and no route accepts them here.
 */
export const RESTRICTED_PERMISSIONS = [
  'admin:restricted:retained-vault-read',
  'admin:restricted:retained-vault-export',
  'admin:restricted:retention-hold',
] as const;
export type RestrictedPermission = (typeof RESTRICTED_PERMISSIONS)[number];

/** Role bundles. The owner role also holds both legal permissions (legal operations plan D-LC3). */
export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly BackofficePermission[]>> = {
  [AdminRole.OWNER]: [
    'admin:account:invite',
    'admin:account:deactivate',
    'admin:access:request',
    'admin:access:approve',
    'admin:audit:read',
    'admin:audit:review',
    'admin:legal:edit',
    'admin:legal:approve',
  ],
  [AdminRole.AUDITOR]: ['admin:audit:read'],
  [AdminRole.LEGAL_EDITOR]: ['admin:legal:edit'],
  [AdminRole.LEGAL_APPROVER]: ['admin:legal:approve'],
};

export function permissionsForRoles(
  roles: readonly AdminRole[],
): ReadonlySet<BackofficePermission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}

function rolesHolding(permission: BackofficePermission): readonly AdminRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as AdminRole[]).filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );
}

/** Roles whose holders may decide a role grant or revoke request (OA-R9). */
export const ROLE_CHANGE_APPROVER_ROLES: readonly AdminRole[] =
  rolesHolding('admin:access:approve');

/** Roles whose holders may decide a legal publish or withdraw request (D-BF6, legal plan D-LC3). */
export const LEGAL_APPROVER_ROLES: readonly AdminRole[] = rolesHolding('admin:legal:approve');
