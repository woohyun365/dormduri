import { AdminRole } from '@repo/database/enums';
import { describe, expect, it } from 'vitest';
import {
  BACKOFFICE_PERMISSIONS,
  permissionsForRoles,
  RESTRICTED_PERMISSIONS,
  LEGAL_APPROVER_ROLES,
  ROLE_CHANGE_APPROVER_ROLES,
  ROLE_PERMISSIONS,
} from './permissions.js';

describe('backoffice permissions', () => {
  it('gives no role a restricted RRPD permission (#236, OA-R11)', () => {
    const granted = Object.values(ROLE_PERMISSIONS).flat() as string[];
    for (const restricted of RESTRICTED_PERMISSIONS) {
      expect(granted).not.toContain(restricted);
      expect(BACKOFFICE_PERMISSIONS as readonly string[]).not.toContain(restricted);
    }
    expect(granted.filter((permission) => permission.startsWith('admin:restricted:'))).toEqual([]);
  });

  it('names every permission admin:<resource>:<action>', () => {
    for (const permission of [...BACKOFFICE_PERMISSIONS, ...RESTRICTED_PERMISSIONS]) {
      expect(permission).toMatch(/^admin:[a-z-]+:[a-z-]+$/u);
    }
  });

  it('defines a bundle for every database role', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(Object.values(AdminRole).sort());
  });

  it('computes permissions from roles and nothing else', () => {
    expect([...permissionsForRoles([])]).toEqual([]);
    expect([...permissionsForRoles(['AUDITOR'])]).toEqual(['admin:audit:read']);
    expect(permissionsForRoles(['OWNER', 'AUDITOR']).size).toBe(8);
  });

  it('gives the owner role both legal permissions (plan D-LC3)', () => {
    const owner = permissionsForRoles(['OWNER']);
    expect(owner.has('admin:legal:edit')).toBe(true);
    expect(owner.has('admin:legal:approve')).toBe(true);
  });

  it('counts the owner and legal approver roles as legal approvers (D-BF6)', () => {
    expect(LEGAL_APPROVER_ROLES).toEqual(['OWNER', 'LEGAL_APPROVER']);
  });

  it('lets only the owner role decide role changes', () => {
    expect(ROLE_CHANGE_APPROVER_ROLES).toEqual(['OWNER']);
  });
});
