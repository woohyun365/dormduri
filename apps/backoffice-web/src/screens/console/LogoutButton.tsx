'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postBff } from '@/client/bff-client';
import { SecondaryButton } from '@/ui/forms';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <SecondaryButton
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await postBff('/api/auth/logout');
        router.replace('/login');
        router.refresh();
      }}
    >
      로그아웃
    </SecondaryButton>
  );
}
