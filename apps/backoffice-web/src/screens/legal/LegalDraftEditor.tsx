'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  legalDraftUpdateRequestSchema,
  type AccountListResponse,
  type LegalDraft,
  type LegalRequest,
} from '@repo/shared/backoffice';
import { legalNoticeClassSchema, type LegalNoticeClass } from '@repo/shared/legal';
import { postBff } from '@/client/bff-client';
import { withReauthentication } from '@/client/passkeys';
import { accountName } from '@/ui/account-name';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectField, TextAreaField, TextField } from '@/ui/fields';
import { formatKstDetail } from '@/ui/format';
import { Icon } from '@/ui/icons';
import {
  LEGAL_DRAFT_STATUS_LABELS,
  LEGAL_KIND_LABELS,
  LEGAL_NOTICE_CLASS_LABELS,
} from '@/ui/labels';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import { PageHeader } from '@/ui/PageHeader';
import { failureText, success, useFailure, type ResultMessage } from '@/ui/result-message';
import { LEGAL_DRAFT_STATUS_MEANING, StatusBadge } from '@/ui/status';
import { TextLink } from '@/ui/TextLink';
import {
  canAskConsent,
  describeIssues,
  editableContent,
  importBody,
  type EditableContent,
} from './draft-form';
import type { LegalDraftDetail } from './legal-types';
import { ComparisonTable, LegalDocumentView } from './LegalSections';
import { SectionsEditor } from './SectionsEditor';

// What the author ticks to choose the significant class (D-LC3, D-SF12). The list only helps the choice and is not
// stored; the approver confirms the class with the comparison.
const SIGNIFICANT_SIGNS = [
  '수집 항목·목적을 더하거나 제3자 제공·국외 이전을 더합니다.',
  '이용자의 의무가 늘어납니다.',
  '이용자에게 불리하게 약관을 바꿉니다.',
] as const;

const EFFECTIVE_DATE_HINTS: Record<LegalNoticeClass, string> = {
  HISTORICAL:
    '이 판이 공개 화면에 보이기 시작한 날입니다. 적용 끝과 함께 승인일(KST) 전이어야 합니다.',
  INITIAL:
    '승인일(KST)과 같거나 앞이어야 합니다. 이전 판 기록이 있으면 마지막 기록의 적용 끝 다음 날입니다.',
  GENERAL: '승인일(KST) + 7일부터 고를 수 있습니다. 승인이 늦어지면 다시 고칩니다.',
  SIGNIFICANT: '승인일(KST) + 30일부터 고를 수 있습니다. 메일 받을 회원이 0명일 때만 승인됩니다.',
};

function serialized(content: EditableContent): string {
  return JSON.stringify(importBody(content));
}

/**
 * Asks before leaving with unsaved changes (design guide ⑤ form): the browser's own question on a reload or a closed
 * tab, and a confirmation before an in-app link. A link the operator confirms opens through the router.
 */
function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [leaving, setLeaving] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // Capture runs before the link's own handler; stopping the click keeps the router from moving.
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving(`${url.pathname}${url.search}`);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);
  const dialog = leaving ? (
    <Overlay
      id="legal-draft-leave"
      variant="confirm"
      title="저장하지 않은 변경"
      description="저장하지 않은 변경이 있습니다. 이 화면을 떠나면 그 변경은 사라집니다."
      onClose={() => setLeaving(null)}
      footer={
        <Button tone="danger-solid" onClick={() => router.push(leaving as Route)}>
          저장하지 않고 떠나기
        </Button>
      }
    />
  ) : null;
  return dialog;
}

/**
 * The legal draft editor (D-LC10, design guide ④ form): basic fields, summary items, the change summary and the
 * section structure editor, then the preview of what is on screen and the comparison the API computed for the saved
 * draft. A save checks the shared import schema here first and saves at the revision the editor read; a publish
 * request asks for a passkey (OA-R4) and only for saved content. A draft waiting for approval, published or left is
 * read-only.
 */
export function LegalDraftEditor({
  detail,
  accounts,
  canEdit,
}: {
  readonly detail: LegalDraftDetail;
  readonly accounts: AccountListResponse['accounts'] | null;
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const failure = useFailure();
  const { draft, previousVersion, comparison } = detail;
  const [content, setContent] = useState(() => editableContent(draft.content));
  const [saved, setSaved] = useState<LegalDraft>(draft);
  const [baseline, setBaseline] = useState(() => serialized(editableContent(draft.content)));
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [pending, setPending] = useState(false);
  const [signs, setSigns] = useState<readonly boolean[]>(SIGNIFICANT_SIGNS.map(() => false));
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardFailure, setDiscardFailure] = useState<ResultMessage | null>(null);
  const [requestReason, setRequestReason] = useState('');
  // A refresh after another operator's save brings a newer revision: take it unless this screen has unsaved changes.
  const [shownRevision, setShownRevision] = useState(draft.revision);
  const dirtyNow = serialized(content) !== baseline;
  if (draft.revision > shownRevision && !dirtyNow) {
    setShownRevision(draft.revision);
    setSaved(draft);
    setContent(editableContent(draft.content));
    setBaseline(serialized(editableContent(draft.content)));
  }
  // The newer of what the page read and what this screen saved; at the same revision the page's read has the status.
  const current = saved.revision > draft.revision ? saved : draft;
  const editable = canEdit && current.status === 'EDITING';
  const dirty = editable && dirtyNow;
  const leaveDialog = useLeaveGuard(dirty);

  function patch(next: Partial<EditableContent>) {
    setContent((previous) => ({ ...previous, ...next }));
  }

  async function save() {
    if (!editable || pending) return;
    const body = { revision: current.revision, draft: importBody(content) };
    const parsed = legalDraftUpdateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const lines = describeIssues(
        parsed.error.issues,
        content.sections.map(({ section }) => section.type),
        1,
      );
      setMessage(failureText(`저장할 수 없습니다. ${lines.join(' ')}`));
      return;
    }
    setPending(true);
    setMessage(null);
    const result = await postBff<LegalDraft>(`/api/legal/drafts/${draft.id}`, body);
    setPending(false);
    if (!result.ok) {
      setMessage(failure(result.code));
      return;
    }
    setSaved(result.data);
    setShownRevision(result.data.revision);
    setBaseline(serialized(content));
    setMessage(success('초안을 저장했습니다.'));
    router.refresh();
  }

  async function requestPublish() {
    if (!editable || dirty || pending) return;
    setPending(true);
    setMessage(null);
    const reason = requestReason.trim();
    const result = await withReauthentication(() =>
      postBff<LegalRequest>(`/api/legal/drafts/${draft.id}/publish-requests`, {
        revision: current.revision,
        ...(reason ? { reason } : {}),
      }),
    );
    setPending(false);
    if (!result.ok) {
      setMessage(failure(result.code));
      return;
    }
    setRequestReason('');
    setMessage(success('게시 승인을 요청했습니다. 승인 권한 운영자가 결정합니다.'));
    router.refresh();
  }

  async function discard() {
    setPending(true);
    setDiscardFailure(null);
    const result = await postBff<LegalDraft>(`/api/legal/drafts/${draft.id}/discard`, {
      revision: current.revision,
    });
    setPending(false);
    if (!result.ok) {
      setDiscardFailure(failure(result.code));
      return;
    }
    setDiscardOpen(false);
    setSaved(result.data);
    setShownRevision(result.data.revision);
    setMessage(success('초안을 버렸습니다.'));
    router.refresh();
  }

  const consentPossible = canAskConsent(content.kind, content.noticeClass);
  const significantSuggested = signs.some(Boolean) && content.noticeClass !== 'SIGNIFICANT';

  return (
    <>
      <PageHeader
        title="초안 편집"
        meta={`${LEGAL_KIND_LABELS[current.kind]} · 판 번호 ${current.revision} · 마지막 저장 ${formatKstDetail(current.updatedAt)}`}
        actions={
          editable ? (
            <Button disabled={pending || !dirty} onClick={() => void save()}>
              저장
            </Button>
          ) : null
        }
      />
      {message ? (
        <Notice tone={message.tone} role={message.role}>
          {message.text}
        </Notice>
      ) : null}
      {current.status === 'PENDING_APPROVAL' ? (
        <Notice tone="info" role="status">
          게시 승인 요청이 대기 중이라 고칠 수 없습니다. 요청이 거절·취소·만료되면 다시 고칠 수
          있습니다.{' '}
          <TextLink href={{ pathname: '/legal/requests', query: { status: 'PENDING' } }}>
            게시 요청 보기
          </TextLink>
        </Notice>
      ) : null}
      {current.status === 'PUBLISHED' ? (
        <Notice tone="success" role="status">
          게시된 초안입니다. 게시된 판은 문서 판에서 봅니다.
        </Notice>
      ) : null}
      {current.status === 'DISCARDED' ? (
        <Notice tone="info" role="status">
          버린 초안입니다. 고치거나 게시를 요청할 수 없습니다.
        </Notice>
      ) : null}
      <form
        id="legal-draft-form"
        aria-label="초안 편집"
        className="flex flex-col gap-stack"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={!editable} className="contents">
          <Card
            id="legal-draft-basics"
            title="기본 정보"
            action={
              <StatusBadge meaning={LEGAL_DRAFT_STATUS_MEANING[current.status]}>
                {LEGAL_DRAFT_STATUS_LABELS[current.status]}
              </StatusBadge>
            }
          >
            <dl className="grid grid-cols-label-value gap-x-6 gap-y-2 text-body">
              <dt className="font-semibold text-fg-muted">문서</dt>
              <dd className="text-fg-neutral">{LEGAL_KIND_LABELS[current.kind]}</dd>
              <dt className="font-semibold text-fg-muted">바로 앞 판</dt>
              <dd className="text-fg-neutral tabular-nums">
                {previousVersion ? `${previousVersion.effectiveDate} 시행` : '없음'}
              </dd>
              <dt className="font-semibold text-fg-muted">작성자</dt>
              <dd className="text-fg-neutral">{accountName(accounts, current.authorAccountId)}</dd>
            </dl>
            <TextField
              id="legal-draft-title"
              label="제목"
              value={content.title}
              maxLength={160}
              onChange={(event) => patch({ title: event.target.value })}
            />
            <SelectField
              id="legal-draft-notice-class"
              label="고지 등급"
              value={content.noticeClass}
              onChange={(event) => {
                const noticeClass = legalNoticeClassSchema.parse(event.target.value);
                patch({
                  noticeClass,
                  appliesUntil: noticeClass === 'HISTORICAL' ? content.appliesUntil : null,
                  consentRequired: canAskConsent(content.kind, noticeClass)
                    ? content.consentRequired
                    : false,
                });
              }}
            >
              {legalNoticeClassSchema.options.map((option) => (
                <option key={option} value={option}>
                  {LEGAL_NOTICE_CLASS_LABELS[option]}
                </option>
              ))}
            </SelectField>
            <fieldset className="flex flex-col gap-2 rounded-card bg-layer-muted p-4">
              <legend className="text-label font-semibold text-fg-label">
                중대 변경 확인(저장하지 않음)
              </legend>
              {SIGNIFICANT_SIGNS.map((sign, index) => (
                <label key={sign} className="flex items-start gap-2 text-body text-fg-label">
                  <input
                    type="checkbox"
                    checked={signs[index]}
                    onChange={(event) =>
                      setSigns((previous) =>
                        previous.map((value, position) =>
                          position === index ? event.target.checked : value,
                        ),
                      )
                    }
                    className="mt-1 size-4 focus-ring"
                  />
                  {sign}
                </label>
              ))}
              {significantSuggested ? (
                <Notice tone="warning" role="status">
                  체크한 항목이 있으면 고지 등급은 중대(30일 공지)입니다.
                </Notice>
              ) : null}
            </fieldset>
            <TextField
              id="legal-draft-effective-date"
              type="date"
              label={content.noticeClass === 'HISTORICAL' ? '적용 시작' : '제안 시행일'}
              hint={EFFECTIVE_DATE_HINTS[content.noticeClass]}
              value={content.proposedEffectiveDate}
              onChange={(event) => patch({ proposedEffectiveDate: event.target.value })}
            />
            {content.noticeClass === 'HISTORICAL' ? (
              <TextField
                id="legal-draft-applies-until"
                type="date"
                label="적용 끝"
                hint="이 판이 공개 화면에 보인 마지막 날입니다."
                value={content.appliesUntil ?? ''}
                onChange={(event) => patch({ appliesUntil: event.target.value || null })}
              />
            ) : null}
            {consentPossible ? (
              <label className="flex items-start gap-2 text-body text-fg-label">
                <input
                  type="checkbox"
                  checked={content.consentRequired}
                  onChange={(event) => patch({ consentRequired: event.target.checked })}
                  aria-describedby="legal-draft-consent-hint"
                  className="mt-1 size-4 focus-ring"
                />
                <span className="flex flex-col gap-1">
                  재동의 필요
                  <span id="legal-draft-consent-hint" className="text-caption text-fg-muted">
                    동의 사항이 바뀌거나 약관이 이용자에게 불리하게 바뀔 때 켭니다. 켜면 메일 받을
                    회원이 0명일 때만 승인됩니다.
                  </span>
                </span>
              </label>
            ) : null}
          </Card>
          <Card id="legal-draft-summary" title="요약 항목">
            {content.summaryItems.length === 0 ? (
              <p className="text-body text-fg-description">요약 항목이 없습니다.</p>
            ) : null}
            {content.summaryItems.map((item, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <TextField
                  id={`legal-draft-summary-${index}`}
                  label={`요약 ${index + 1}`}
                  value={item}
                  maxLength={240}
                  onChange={(event) =>
                    patch({
                      summaryItems: content.summaryItems.map((value, position) =>
                        position === index ? event.target.value : value,
                      ),
                    })
                  }
                />
                <Button
                  tone="danger"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    patch({
                      summaryItems: content.summaryItems.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                >
                  요약 {index + 1} 지우기
                </Button>
              </div>
            ))}
            <Button
              tone="secondary"
              size="sm"
              className="self-start"
              onClick={() => patch({ summaryItems: [...content.summaryItems, ''] })}
            >
              <Icon name="plus" className="size-4" />
              요약 더하기
            </Button>
          </Card>
          <Card id="legal-draft-change" title="변경 요약">
            <TextAreaField
              id="legal-draft-change-summary"
              label="변경 요약"
              hint="공개 화면의 판 목록과 개정 예고에 보입니다. 무엇이 왜 바뀌는지 적습니다."
              value={content.changeSummary}
              rows={3}
              maxLength={8000}
              onChange={(event) => patch({ changeSummary: event.target.value })}
            />
          </Card>
          <Card id="legal-draft-sections" title="본문">
            {editable ? (
              <SectionsEditor
                sections={content.sections}
                onChange={(sections) => patch({ sections })}
              />
            ) : (
              <p className="text-body text-fg-description">
                고칠 수 없는 초안입니다. 본문은 아래 미리보기에서 봅니다.
              </p>
            )}
          </Card>
        </fieldset>
      </form>
      <Card id="legal-draft-preview" title="미리보기">
        <p className="text-caption text-fg-muted">
          공개 화면과 같은 순서로 글자 그대로 그립니다. 저장하지 않은 변경도 보입니다.
        </p>
        <LegalDocumentView
          label="미리보기"
          title={content.title}
          summaryItems={content.summaryItems}
          sections={content.sections.map(({ section }) => section)}
        />
      </Card>
      <Card id="legal-draft-comparison" title="조항 대조표">
        {previousVersion ? (
          <>
            <p className="text-caption text-fg-muted tabular-nums">
              저장한 초안과 바로 앞 판({previousVersion.effectiveDate} 시행)의 대조입니다.
              {dirty ? ' 저장하지 않은 변경은 저장한 뒤 대조표에 들어갑니다.' : ''}
            </p>
            <ComparisonTable articles={comparison} />
          </>
        ) : (
          <p className="text-body text-fg-description">
            앞 판이 없어 대조표가 없습니다. 이전 판 기록과 첫 게시는 본문 전체를 확인합니다.
          </p>
        )}
      </Card>
      {editable ? (
        <Card id="legal-draft-publish" title="게시 요청">
          <TextAreaField
            id="legal-draft-request-reason"
            label="요청 사유(선택)"
            hint="사용자 개인정보는 쓰지 마세요. 요청 전에 passkey로 다시 확인합니다."
            value={requestReason}
            maxLength={500}
            onChange={(event) => setRequestReason(event.target.value)}
          />
          {dirty ? (
            <p className="text-caption text-fg-warning">
              저장하지 않은 변경이 있습니다. 저장한 뒤 요청하세요.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              tone="secondary"
              disabled={pending || dirty}
              onClick={() => void requestPublish()}
            >
              게시 승인 요청
            </Button>
            <Button
              tone="danger"
              disabled={pending}
              className="ml-auto"
              onClick={() => {
                setDiscardFailure(null);
                setDiscardOpen(true);
              }}
            >
              초안 버리기
            </Button>
          </div>
        </Card>
      ) : null}
      {discardOpen ? (
        <Overlay
          id="legal-draft-discard"
          variant="confirm"
          title="초안 버리기"
          description="버린 초안은 다시 고치거나 게시를 요청할 수 없습니다. 같은 내용이 필요하면 새 초안을 만듭니다."
          busy={pending}
          onClose={() => setDiscardOpen(false)}
          footer={
            <Button tone="danger-solid" disabled={pending} onClick={() => void discard()}>
              버리기
            </Button>
          }
        >
          {discardFailure ? (
            <Notice tone={discardFailure.tone} role={discardFailure.role}>
              {discardFailure.text}
            </Notice>
          ) : null}
        </Overlay>
      ) : null}
      {leaveDialog}
    </>
  );
}
