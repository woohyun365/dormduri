// Story BFF answers (design guide ⑨): a story that opens a later step of a screen answers the BFF paths that step
// calls with fixtures and puts `fetch` back when the story ends. A path without an answer is a story error.
export type BffAnswers = Readonly<Record<`/api/${string}`, unknown>>;

export function answerBff(answers: BffAnswers): () => void {
  const original = window.fetch;
  window.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (Object.hasOwn(answers, url.pathname)) {
      return Response.json(answers[url.pathname as keyof BffAnswers]);
    }
    console.error(`story BFF answer missing: ${url.pathname}`);
    return Response.json({ error: { code: 'internal_error' } }, { status: 500 });
  };
  return () => {
    window.fetch = original;
  };
}
