import type { FormEvent } from 'react';
import type {
  AccountListResponse,
  BackofficeRole,
  RoleCatalogResponse,
} from '@repo/shared/backoffice';
import { Button } from '@/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/ui/fields';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import { REQUEST_KIND_LABELS, ROLE_LABELS } from '@/ui/labels';
import type { ResultMessage } from '@/ui/result-message';

/**
 * A new role grant or revoke request in the right drawer. Without the account list (no owner role) the target is an
 * account id typed in. A failure stays inside with what was typed (design guide ⑥).
 */
export function NewRequestDrawer({
  roles,
  accounts,
  pending,
  failure,
  onSubmit,
  onClose,
}: {
  readonly roles: RoleCatalogResponse['roles'];
  readonly accounts: AccountListResponse['accounts'] | null;
  readonly pending: boolean;
  readonly failure: ResultMessage | null;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onClose: () => void;
}) {
  return (
    <Overlay
      id="new-request-overlay"
      title="새 요청"
      onClose={onClose}
      footer={
        <Button type="submit" form="new-request" disabled={pending}>
          요청 만들기
        </Button>
      }
    >
      <form
        id="new-request"
        aria-label="권한 요청 만들기"
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
      >
        <SelectField id="request-kind" name="kind" label="종류">
          <option value="ROLE_GRANT">{REQUEST_KIND_LABELS.ROLE_GRANT}</option>
          <option value="ROLE_REVOKE">{REQUEST_KIND_LABELS.ROLE_REVOKE}</option>
        </SelectField>
        {accounts ? (
          <SelectField id="request-target" name="targetAccountId" label="대상 운영자" required>
            {accounts
              .filter((account) => account.status === 'ACTIVE')
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName} ({account.email})
                </option>
              ))}
          </SelectField>
        ) : (
          <TextField
            id="request-target"
            name="targetAccountId"
            label="대상 운영자"
            placeholder="계정 id"
            required
          />
        )}
        <SelectField id="request-role" name="targetRole" label="역할">
          {roles.map(({ role }) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role as BackofficeRole]}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          id="request-reason"
          name="reason"
          label="사유(선택)"
          hint="업무 사유만 적고 사용자 개인정보는 쓰지 마세요. 요청 전에 passkey로 다시 확인합니다."
          maxLength={500}
        />
      </form>
      {failure ? (
        <Notice tone={failure.tone} role={failure.role}>
          {failure.text}
        </Notice>
      ) : null}
    </Overlay>
  );
}
