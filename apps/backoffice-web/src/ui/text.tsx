import { Fragment } from 'react';
import type { BackofficeRole } from '@repo/shared/backoffice';
import { ROLE_LABELS } from './labels';

// Where a value may wrap (design guide ⑦, D-OD14): the page wraps Korean text between words; these values pick their own
// break points, so a line never splits a date, an address part or a role's code.

/** A time that may wrap only between the date and the clock, never at a hyphen of the date. */
export function TimeText({ text }: { readonly text: string }) {
  const [date, ...rest] = text.split(' ');
  return (
    <>
      <span className="whitespace-nowrap">{date}</span>
      {rest.length ? (
        <>
          {' '}
          <span className="whitespace-nowrap">{rest.join(' ')}</span>
        </>
      ) : null}
    </>
  );
}

/** An address that may wrap only before `@` and `.`, never inside a part; the text stays the same. */
export function EmailText({ address }: { readonly address: string }) {
  return (
    <>
      {address.split(/(?=[@.])/u).map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </>
  );
}

/** Role names joined by commas: a line breaks between roles or between a role's name and its code, never inside either. */
export function RoleText({ roles }: { readonly roles: readonly BackofficeRole[] }) {
  if (!roles.length) return <>없음</>;
  return (
    <>
      {roles.map((role, index) => {
        const label = ROLE_LABELS[role];
        const cut = label.indexOf('(');
        const comma = index < roles.length - 1 ? ', ' : '';
        return cut < 0 ? (
          <span key={role} className="whitespace-nowrap">
            {label}
            {comma}
          </span>
        ) : (
          <span key={role}>
            <span className="whitespace-nowrap">{label.slice(0, cut)}</span>
            <wbr />
            <span className="whitespace-nowrap">
              {label.slice(cut)}
              {comma}
            </span>
          </span>
        );
      })}
    </>
  );
}
