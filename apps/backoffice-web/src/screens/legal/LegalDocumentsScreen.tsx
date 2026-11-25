import type { Route } from 'next';
import { legalDocumentKindSchema } from '@repo/shared/legal';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { formatKstShort } from '@/ui/format';
import {
  LEGAL_KIND_LABELS,
  LEGAL_NOTICE_CLASS_LABELS,
  LEGAL_VERSION_STATE_LABELS,
} from '@/ui/labels';
import { LEGAL_VERSION_STATE_MEANING, StatusBadge } from '@/ui/status';
import { TableRegion, TD, TH } from '@/ui/table';
import { TextLink } from '@/ui/TextLink';
import { PageHeader } from '@/ui/PageHeader';
import type { LegalDocumentsOverview } from './legal-types';

/**
 * Every document kind's published versions as of the database clock (design guide ④ list): newest effective date
 * first, each with its state, class and dates; a version opens its detail. A kind without a version says so, since the
 * API lists only the kinds that have one.
 */
export function LegalDocumentsScreen({ overview }: { readonly overview: LegalDocumentsOverview }) {
  const byKind = new Map(overview.documents.map((document) => [document.kind, document.versions]));
  const total = overview.documents.reduce((sum, document) => sum + document.versions.length, 0);
  return (
    <>
      <PageHeader
        title="문서 판"
        meta={`문서 ${legalDocumentKindSchema.options.length}종 · 판 ${total}개`}
      />
      {legalDocumentKindSchema.options.map((kind) => {
        const versions = byKind.get(kind) ?? [];
        return (
          <Card key={kind} id={`legal-${kind.toLowerCase()}`} title={LEGAL_KIND_LABELS[kind]} flush>
            {versions.length === 0 ? (
              <div className="px-card pb-card">
                <EmptyState icon="document" title="게시된 판이 없습니다.">
                  초안에서 JSON 파일로 이전 판 기록이나 첫 게시를 가져와 승인합니다.
                </EmptyState>
              </div>
            ) : (
              <TableRegion label={`${LEGAL_KIND_LABELS[kind]} 판 목록`}>
                <table className="w-full min-w-160 border-t border-stroke-subtle lg:max-xl:min-w-0">
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>
                        시행일
                      </th>
                      <th scope="col" className={TH}>
                        상태
                      </th>
                      <th scope="col" className={TH}>
                        고지 등급
                      </th>
                      <th scope="col" className={TH}>
                        적용 끝
                      </th>
                      <th scope="col" className={TH}>
                        공지 시작(KST)
                      </th>
                      <th scope="col" className={TH}>
                        재동의
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke-row">
                    {versions.map((version) => (
                      <tr key={version.id}>
                        <td className={`${TD} font-semibold tabular-nums`}>
                          <TextLink href={`/legal/versions/${version.id}` as Route}>
                            {version.effectiveDate}
                          </TextLink>
                          {version.selfApproved ? (
                            <span className="block text-caption font-normal text-fg-muted">
                              자기 승인
                            </span>
                          ) : null}
                        </td>
                        <td className={TD}>
                          <StatusBadge meaning={LEGAL_VERSION_STATE_MEANING[version.state]}>
                            {LEGAL_VERSION_STATE_LABELS[version.state]}
                          </StatusBadge>
                        </td>
                        <td className={TD}>{LEGAL_NOTICE_CLASS_LABELS[version.noticeClass]}</td>
                        <td className={`${TD} tabular-nums`}>{version.appliesUntil ?? '—'}</td>
                        <td className={`${TD} tabular-nums`}>
                          {formatKstShort(version.publishedAt)}
                        </td>
                        <td className={TD}>{version.consentRequired ? '필요' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableRegion>
            )}
          </Card>
        );
      })}
    </>
  );
}
