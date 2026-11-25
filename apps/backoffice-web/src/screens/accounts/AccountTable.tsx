import type { AccountListResponse } from '@repo/shared/backoffice';
import { Button } from '@/ui/Button';
import { formatKstShort } from '@/ui/format';
import { Icon } from '@/ui/icons';
import { StatusBadge } from '@/ui/status';
import { TD, TH, TableRegion } from '@/ui/table';
import { EmailText, RoleText, TimeText } from '@/ui/text';

type Account = AccountListResponse['accounts'][number];

function AccountStatus({ account }: { readonly account: Account }) {
  return (
    <span className="flex flex-nowrap gap-x-4 gap-y-1 lg:max-xl:flex-col lg:max-xl:items-start">
      {account.status === 'ACTIVE' ? (
        <StatusBadge meaning="success">활성</StatusBadge>
      ) : (
        <StatusBadge meaning="pending">비활성</StatusBadge>
      )}
      {account.locked ? <StatusBadge meaning="warning">잠김</StatusBadge> : null}
    </span>
  );
}

/**
 * The operator accounts table. A name breaks at spaces and only a word longer than its cell breaks inside the cell
 * (design guide ⑦, no ellipsis); the address, the roles and the last login keep their own break points.
 */
export function AccountTable({
  accounts,
  selfAccountId,
  canDeactivate,
  pending,
  onDeactivate,
}: {
  readonly accounts: readonly Account[];
  readonly selfAccountId: string;
  readonly canDeactivate: boolean;
  readonly pending: boolean;
  readonly onDeactivate: (accountId: string) => void;
}) {
  return (
    <TableRegion label="운영자 계정 표">
      <table className="w-full min-w-160 border-t border-stroke-subtle lg:max-xl:min-w-0">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              이름
            </th>
            <th scope="col" className={TH}>
              이메일
            </th>
            <th scope="col" className={TH}>
              상태
            </th>
            <th scope="col" className={TH}>
              역할
            </th>
            <th scope="col" className={TH}>
              마지막 로그인(KST)
            </th>
            <th scope="col" className={TH}>
              <span className="sr-only">작업</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke-row">
          {accounts.map((account) => (
            <tr key={account.id} className="hover:bg-layer-muted">
              <td className={`${TD} min-w-36 font-semibold wrap-anywhere lg:max-xl:min-w-28`}>
                {account.displayName}
                {account.id === selfAccountId ? (
                  <span className="ml-1.5 text-caption font-medium text-fg-muted">(나)</span>
                ) : null}
              </td>
              <td className={`${TD} min-w-48 text-fg-description lg:max-xl:min-w-36`}>
                <EmailText address={account.email} />
              </td>
              <td className={TD}>
                <AccountStatus account={account} />
              </td>
              <td className={`${TD} text-fg-description`}>
                <RoleText roles={account.roles} />
              </td>
              <td
                className={`${TD} whitespace-nowrap text-fg-description tabular-nums lg:max-xl:whitespace-normal`}
              >
                <TimeText text={formatKstShort(account.lastLoginAt)} />
              </td>
              <td className={`${TD} text-right`}>
                {canDeactivate && account.status === 'ACTIVE' && account.id !== selfAccountId ? (
                  <Button
                    tone="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() => onDeactivate(account.id)}
                  >
                    <Icon name="ban" className="size-4" />
                    비활성화
                    <span className="sr-only"> {account.displayName}</span>
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}
