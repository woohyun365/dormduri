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

/** The action cell (third column) of each body row, in order. */
function actionCells(): string[] {
  const table = screen.getByRole('table', { name: '관리자 감사 기록, 최신순' });
  const [, ...rows] = within(table).getAllByRole('row');
  return rows.map((row) => within(row).getAllByRole('cell')[2]!.textContent ?? '');
}

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
      />,
    );
    expect(actionCells()).toEqual([
      '복구 로그인(TOTP)',
      '복구 로그인(복구 code)',
      '로그인',
      '로그인',
    ]);
  });
});
