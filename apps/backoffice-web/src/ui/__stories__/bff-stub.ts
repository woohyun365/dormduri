// Story BFF answers (design guide ⑨): a story that opens a later step of a screen answers the BFF paths that step
// calls with fixtures and puts `fetch` back when the story ends. A path without an answer is a story error.
const FAILURE = Symbol('story BFF failure');

type Failure = { readonly [FAILURE]: true; readonly status: number; readonly code: string };

/** An error answer of the BFF (`{ error: { code } }` with its HTTP status). */
export function bffFailure(status: number, code: string): Failure {
  return { [FAILURE]: true, status, code };
}

export type BffAnswers = Readonly<Record<`/api/${string}`, unknown>>;

function isFailure(value: unknown): value is Failure {
  return typeof value === 'object' && value !== null && FAILURE in value;
}

export function answerBff(answers: BffAnswers): () => void {
  const original = window.fetch;
  window.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (Object.hasOwn(answers, url.pathname)) {
      const answer = answers[url.pathname as keyof BffAnswers];
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
