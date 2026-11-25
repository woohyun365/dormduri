// Story BFF answers (design guide ⑨): a story that opens a later step of a screen answers the BFF paths that step
// calls with fixtures and puts `fetch` back when the story ends. A path without an answer is a story error.
const FAILURE = Symbol('story BFF failure');

type Failure = { readonly [FAILURE]: true; readonly status: number; readonly code: string };

/** An error answer of the BFF (`{ error: { code } }` with its HTTP status). */
export function bffFailure(status: number, code: string): Failure {
  return { [FAILURE]: true, status, code };
}

const WAITING = Symbol('story BFF waiting');

type Waiting = { readonly [WAITING]: true };

/** An answer that never comes: the step stays in flight, as a submit waiting on a slow network. */
export function bffWaiting(): Waiting {
  return { [WAITING]: true };
}

export type BffAnswers = Readonly<Record<`/api/${string}`, unknown>>;

function isFailure(value: unknown): value is Failure {
  return typeof value === 'object' && value !== null && FAILURE in value;
}

function isWaiting(value: unknown): value is Waiting {
  return typeof value === 'object' && value !== null && WAITING in value;
}

export function answerBff(answers: BffAnswers): () => void {
  const original = window.fetch;
  window.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (Object.hasOwn(answers, url.pathname)) {
      const answer = answers[url.pathname as keyof BffAnswers];
      if (isWaiting(answer)) return new Promise<Response>(() => undefined);
      return isFailure(answer)
        ? Response.json({ error: { code: answer.code } }, { status: answer.status })
        : Response.json(answer);
    }
    console.error(`story BFF answer missing: ${url.pathname}`);
    return Response.json({ error: { code: 'internal_error' } }, { status: 500 });
  };
  return () => {
    window.fetch = original;
  };
}
