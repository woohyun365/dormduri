import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '@repo/shared/backoffice';
import { AuditTable } from './AuditTable';

function login(id: string, metadata: unknown): AuditEvent {
  return {
    id,
    occurredAt: '2026-11-24T09:40:00+09:00',
    actorType: 'ADMIN',
    actorAccountId: '00000000-0000-4000-8000-000000000001',
    sessionId: id,
    accessPath: 'SSM_PORT_FORWARD',
    action: 'LOGIN',
    targetType: 'ADMIN_SESSION',
    targetId: id,
    approvalRequestId: null,
    result: 'SUCCEEDED',
    selfApproved: false,
    reason: null,
    requestId: null,
    metadata,
  };
}

/** The cell under the given column header in each body row, in order. */
function columnCells(name: string): string[] {
  const table = screen.getByRole('table', { name: '관리자 감사 기록, 최신순' });
  const [header, ...rows] = within(table).getAllByRole('row');
  const column = within(header!)
    .getAllByRole('columnheader')
    .findIndex((cell) => cell.textContent === name);
  expect(column).not.toBe(-1);
  return rows.map((row) => within(row).getAllByRole('cell')[column]!.textContent ?? '');
}

const actionCells = () => columnCells('행동');

describe('AuditTable (OA-R7)', () => {
  it('names a recovery login in the action cell', () => {
    render(
      <AuditTable
        events={[
          login('00000000-0000-4000-8000-000000000501', { scope: 'RECOVERY', method: 'totp' }),
          login('00000000-0000-4000-8000-000000000502', {
            scope: 'RECOVERY',
            method: 'recovery_code',
          }),
          login('00000000-0000-4000-8000-000000000503', { scope: 'FULL', method: 'passkey' }),
          login('00000000-0000-4000-8000-000000000504', { step: 'totp' }),
        ]}
        names={{}}
        onOpen={() => {}}
      />,
    );
    expect(actionCells()).toEqual([
      '복구 로그인(TOTP)',
      '복구 로그인(복구 code)',
      '로그인',
      '로그인',
    ]);
  });

  it('names the target kinds the API writes in short Korean and keeps an unknown kind as its code', () => {
    const target = (id: string, targetType: string): AuditEvent => ({
      ...login(id, null),
      action: 'ACCESS_REQUEST_APPROVE',
      targetType,
      targetId: id,
    });
    render(
      <AuditTable
        events={[
          target('a1000000-0000-4000-8000-000000000601', 'ADMIN_APPROVAL_REQUEST'),
          target('a2000000-0000-4000-8000-000000000602', 'ADMIN_ROLE_ASSIGNMENT'),
          target('a3000000-0000-4000-8000-000000000603', 'ADMIN_PASSKEY_CREDENTIAL'),
          target('a4000000-0000-4000-8000-000000000604', 'ADMIN_ACCOUNT'),
          target('a5000000-0000-4000-8000-000000000605', 'ADMIN_INVITATION'),
          target('a6000000-0000-4000-8000-000000000606', 'ADMIN_SESSION'),
          target('a7000000-0000-4000-8000-000000000607', 'NEW_TARGET_KIND'),
        ]}
        names={{}}
        onOpen={() => {}}
      />,
    );
    expect(columnCells('대상')).toEqual([
      '권한 요청 a1000000',
      '역할 배정 a2000000',
      'passkey a3000000',
      '계정 a4000000',
      '초대 a5000000',
      '접속 a6000000',
      'NEW_TARGET_KIND a7000000',
    ]);
  });
});
