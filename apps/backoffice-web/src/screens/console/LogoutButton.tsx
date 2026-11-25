'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postBff } from '@/client/bff-client';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      tone="secondary"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await postBff('/api/auth/logout');
        // The BFF dropped the cookie either way; say so when the API could not end the session.
        router.replace(result.ok ? '/login' : '/login?ended=unconfirmed');
        router.refresh();
      }}
    >
      <Icon name="logout" className="size-4" />
      로그아웃
    </Button>
  );
}
