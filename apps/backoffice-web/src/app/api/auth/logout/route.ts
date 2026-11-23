import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/logout',
  access: 'session',
  body: null,
  response: null,
  endsSession: true,
});
