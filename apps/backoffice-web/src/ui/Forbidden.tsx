import { EmptyState } from './EmptyState';
import { PageHeader } from './PageHeader';

/**
 * A console page without the permission: the page's own title stays and the body says why (design guide ⑥). A missing
 * permission (403) reads apart from a missing page (404).
 */
export function Forbidden({ title }: { readonly title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div role="alert">
        <EmptyState icon="security" title="이 화면을 볼 권한이 없습니다.">
          필요한 역할은 권한 요청으로 받습니다.
        </EmptyState>
      </div>
    </>
  );
}
