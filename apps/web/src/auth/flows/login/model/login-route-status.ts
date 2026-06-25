export type LoginRouteStatusVariant = 'success';

export interface LoginRouteStatus {
  variant: LoginRouteStatusVariant;
  title: string;
  message: string;
}

type LoginRouteSearchParams = Pick<URLSearchParams, 'get'> | null | undefined;

export function mapLoginRouteStatus(searchParams: LoginRouteSearchParams): LoginRouteStatus | null {
  if (searchParams?.get('reset') !== 'success') return null;

  return {
    variant: 'success',
    title: '비밀번호가 변경되었어요',
    message: '새 비밀번호로 다시 로그인해주세요.',
  };
}
