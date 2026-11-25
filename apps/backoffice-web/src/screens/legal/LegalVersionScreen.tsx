'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  legalDraftCreateRequestSchema,
  type LegalBackofficeVersionDetail,
  type LegalDraft,
  type LegalRequest,
  type LegalVersionState,
} from '@repo/shared/backoffice';
import { toLegalKstDate, type LegalNoticeClass } from '@repo/shared/legal';
import { postBff } from '@/client/bff-client';
import { withReauthentication } from '@/client/passkeys';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectField, TextAreaField, TextField } from '@/ui/fields';
import { formatKstDetail, shortId } from '@/ui/format';
import {
  LEGAL_KIND_LABELS,
  LEGAL_NOTICE_CLASS_LABELS,
  LEGAL_VERSION_STATE_LABELS,
} from '@/ui/labels';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import { PageHeader } from '@/ui/PageHeader';
import { failureText, success, useFailure, type ResultMessage } from '@/ui/result-message';
import { LEGAL_VERSION_STATE_MEANING, StatusBadge } from '@/ui/status';
import { TextLink } from '@/ui/TextLink';
import { canAskConsent, describeIssues } from './draft-form';
import { LegalDocumentView } from './LegalSections';

const NOTICE_DAYS: Readonly<Partial<Record<LegalNoticeClass, number>>> = {
  GENERAL: 7,
  SIGNIFICANT: 30,
};

function daysFromToday(days: number): string {
  const today = toLegalKstDate(new Date());
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * A new draft from a published version's text (the editor source of `POST /legal/drafts`): the operator picks the class
 * and the date and says what changes; the body is the version's as it is, to edit in the editor next.
 */
function NewDraftDrawer({
  version,
  onClose,
}: {
  readonly version: LegalBackofficeVersionDetail;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const failure = useFailure();
  const [noticeClass, setNoticeClass] = useState<'GENERAL' | 'SIGNIFICANT'>('GENERAL');
  const [date, setDate] = useState(() => daysFromToday(NOTICE_DAYS.GENERAL!));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const consentPossible = canAskConsent(version.kind, noticeClass);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      source: 'editor',
      draft: {
        kind: version.kind,
        contentSchemaVersion: version.contentSchemaVersion,
        title: version.title,
        summaryItems: version.summaryItems,
        sections: version.sections,
        changeSummary: String(form.get('changeSummary') ?? ''),
        noticeClass,
        consentRequired: consentPossible && form.get('consentRequired') === 'on',
        proposedEffectiveDate: date,
      },
    };
    const parsed = legalDraftCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const lines = describeIssues(
        parsed.error.issues,
        version.sections.map((section) => section.type),
        1,
      );
      setMessage(failureText(`초안을 만들 수 없습니다. ${lines.join(' ')}`));
      return;
    }
    setPending(true);
    setMessage(null);
    const result = await postBff<LegalDraft>('/api/legal/drafts', body);
    setPending(false);
    if (!result.ok) {
      setMessage(failure(result.code));
      return;
    }
    router.push(`/legal/drafts/${result.data.id}` as Route);
  }

  return (
    <Overlay
      id="legal-new-draft"
      title="이 판으로 새 초안"
      busy={pending}
      onClose={onClose}
      footer={
        <Button type="submit" form="legal-new-draft-form" disabled={pending}>
          초안 만들기
        </Button>
      }
    >
      <form
        id="legal-new-draft-form"
        aria-label="새 초안 만들기"
        className="flex flex-col gap-4"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-body text-fg-description">
          {LEGAL_KIND_LABELS[version.kind]} {version.effectiveDate} 판의 제목·요약·본문으로 초안을
          만듭니다. 본문은 편집기에서 고칩니다.
        </p>
        <SelectField
          id="legal-new-draft-class"
          label="고지 등급"
          value={noticeClass}
          onChange={(event) => {
            const next = event.target.value === 'SIGNIFICANT' ? 'SIGNIFICANT' : 'GENERAL';
            setNoticeClass(next);
            setDate(daysFromToday(NOTICE_DAYS[next]!));
          }}
        >
          <option value="GENERAL">{LEGAL_NOTICE_CLASS_LABELS.GENERAL}</option>
          <option value="SIGNIFICANT">{LEGAL_NOTICE_CLASS_LABELS.SIGNIFICANT}</option>
        </SelectField>
        <TextField
          id="legal-new-draft-date"
          type="date"
          label="제안 시행일"
          hint={`오늘(KST) 승인하면 ${daysFromToday(NOTICE_DAYS[noticeClass]!)}부터 고를 수 있습니다.`}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <TextAreaField
          id="legal-new-draft-change"
          name="changeSummary"
          label="변경 요약"
          hint="공개 화면의 판 목록과 개정 예고에 보입니다."
          rows={3}
          maxLength={8000}
        />
        {consentPossible ? (
          <label className="flex items-start gap-2 text-body text-fg-label">
            <input type="checkbox" name="consentRequired" className="mt-1 size-4 focus-ring" />
            재동의 필요
          </label>
        ) : null}
        {message ? (
          <Notice tone={message.tone} role={message.role}>
            {message.text}
          </Notice>
        ) : null}
      </form>
    </Overlay>
  );
}

/**
 * One published version (D-LC10): its facts, its text as the public screen draws it and, for the editor, a new draft
 * from it. A scheduled general or significant version can be asked to be withdrawn (a risky confirmation with a
 * passkey, OA-R4); its own approver decides on the requests screen.
 */
export function LegalVersionScreen({
  version,
  state,
  canEdit,
}: {
  readonly version: LegalBackofficeVersionDetail;
  /** The state from the documents overview; null when the version is not in it. */
  readonly state: LegalVersionState | null;
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const failure = useFailure();
  const [newOpen, setNewOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [withdrawFailure, setWithdrawFailure] = useState<ResultMessage | null>(null);
  const withdrawable =
    canEdit &&
    state === 'scheduled' &&
    (version.noticeClass === 'GENERAL' || version.noticeClass === 'SIGNIFICANT');

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    setPending(true);
    setWithdrawFailure(null);
    const result = await withReauthentication(() =>
      postBff<LegalRequest>(
        `/api/legal/versions/${version.id}/withdraw-requests`,
        reason ? { reason } : {},
      ),
    );
    setPending(false);
    if (!result.ok) {
      setWithdrawFailure(failure(result.code));
      return;
    }
    setWithdrawOpen(false);
    setMessage(success('철회 요청을 만들었습니다. 승인 권한 운영자가 결정합니다.'));
    router.refresh();
  }

  const rows: [string, string][] = [
    ['고지 등급', LEGAL_NOTICE_CLASS_LABELS[version.noticeClass]],
    version.noticeClass === 'HISTORICAL'
      ? ['적용 기간', `${version.effectiveDate} ~ ${version.appliesUntil ?? '—'}`]
      : ['시행일', version.effectiveDate],
    ['재동의', version.consentRequired ? '필요' : '필요 없음'],
    ['공지 시작(승인)', formatKstDetail(version.publishedAt)],
    ['철회', formatKstDetail(version.withdrawnAt)],
    ['자기 승인', version.selfApproved ? '예' : '아니요'],
    ['내용 digest', shortId(version.contentDigest)],
    ['판 표지', version.version],
  ];

  return (
    <>
      <PageHeader
        title={`${LEGAL_KIND_LABELS[version.kind]} ${version.effectiveDate} 판`}
        meta={state ? LEGAL_VERSION_STATE_LABELS[state] : undefined}
        actions={
          canEdit ? <Button onClick={() => setNewOpen(true)}>이 판으로 새 초안</Button> : null
        }
      />
      {message ? (
        <Notice tone={message.tone} role={message.role}>
          {message.text}{' '}
          <TextLink href={{ pathname: '/legal/requests', query: { status: 'PENDING' } }}>
            게시 요청 보기
          </TextLink>
        </Notice>
      ) : null}
      <div className="grid items-start gap-stack xl:grid-cols-3">
        <Card
          id="legal-version-facts"
          title="판 정보"
          action={
            state ? (
              <StatusBadge meaning={LEGAL_VERSION_STATE_MEANING[state]}>
                {LEGAL_VERSION_STATE_LABELS[state]}
              </StatusBadge>
            ) : null
          }
        >
          <dl className="flex flex-col gap-3">
            {rows.map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-caption font-semibold text-fg-muted">{label}</dt>
                <dd className="text-body text-fg-neutral tabular-nums wrap-anywhere">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1">
            <h3 className="text-label font-semibold text-fg-label">변경 요약</h3>
            <p className="text-body text-fg-neutral">{version.changeSummary}</p>
          </div>
          {withdrawable ? (
            <Button
              tone="danger"
              className="self-start"
              onClick={() => {
                setWithdrawFailure(null);
                setWithdrawOpen(true);
              }}
            >
              철회 요청
            </Button>
          ) : null}
        </Card>
        <Card id="legal-version-body" title="본문" className="xl:col-span-2">
          <LegalDocumentView
            label="본문"
            title={version.title}
            summaryItems={version.summaryItems}
            sections={version.sections}
          />
        </Card>
      </div>
      {withdrawOpen ? (
        <Overlay
          id="legal-withdraw"
          variant="confirm"
          title="철회 요청"
          description={`${LEGAL_KIND_LABELS[version.kind]} ${version.effectiveDate} 판의 철회를 요청합니다. 승인되면 공개 목록에서 빠지고 되돌릴 수 없습니다. 다시 고지하려면 새 초안으로 처음부터 공지합니다.`}
          busy={pending}
          onClose={() => setWithdrawOpen(false)}
          footer={
            <Button type="submit" form="legal-withdraw-form" tone="danger-solid" disabled={pending}>
              철회 요청 만들기
            </Button>
          }
        >
          <form
            id="legal-withdraw-form"
            aria-label="철회 요청 만들기"
            className="flex flex-col gap-3"
            onSubmit={(event) => void withdraw(event)}
          >
            <TextAreaField
              id="legal-withdraw-reason"
              name="reason"
              label="철회 사유(선택)"
              hint="사용자 개인정보는 쓰지 마세요. 요청 전에 passkey로 다시 확인합니다."
              maxLength={500}
            />
            {withdrawFailure ? (
              <Notice tone={withdrawFailure.tone} role={withdrawFailure.role}>
                {withdrawFailure.text}
              </Notice>
            ) : null}
          </form>
        </Overlay>
      ) : null}
      {newOpen ? <NewDraftDrawer version={version} onClose={() => setNewOpen(false)} /> : null}
    </>
  );
}
