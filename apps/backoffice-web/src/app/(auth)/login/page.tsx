import { redirect } from 'next/navigation';
import { LoginScreen } from '@/screens/login/LoginScreen';
import { readSession } from '@/server/session';

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await readSession();
  if (state.kind === 'active') {
    redirect(state.session.scope === 'RECOVERY' ? '/recovery' : '/');
  }
  const { ended } = await searchParams;
  return (
    <LoginScreen
      ended={ended === 'idle' || ended === 'expired' || ended === 'unconfirmed' ? ended : null}
    />
  );
}
