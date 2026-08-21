import type { BffRouteContext } from '../src/app/api/_bff/forward';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;
type RouteParams = { id: string };

type RouteContextParamsMustBePromise = Expect<
  Equal<BffRouteContext<RouteParams>['params'], Promise<RouteParams>>
>;

const validContext: BffRouteContext<RouteParams> = {
  params: Promise.resolve({ id: 'request-1' }),
};

const invalidSynchronousContext: BffRouteContext<RouteParams> = {
  // @ts-expect-error Next.js 16 Route Handler params are Promise-only.
  params: { id: 'request-1' },
};

export type { RouteContextParamsMustBePromise };
export { invalidSynchronousContext, validContext };
