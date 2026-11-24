// The "Dispatch 전 단계" section both knu-review skills carry (P6 ③ RED 4·6): lead bullets and numbered steps with
// the same names in the same order, and the sentences each one must hold in both hosts.

export const DISPATCH_BULLETS = ['Subject 경로', 'Runner 환경', 'Runner 기록 내용'];
export const DISPATCH_STEPS = [
  '자체 정합 점검',
  '새 파일',
  'RED 사유',
  '인용',
  '계획 리뷰 등급',
  'Mutation',
  'Runner 기록 검사',
];

// Sentences per bullet or step, read with whitespace folded to one space.
export const DISPATCH_PHRASES = {
  'Subject 경로': [
    '소비자·실행 경로(호출부, 그 동작을 실행하는 test·CLI 진입)',
    'Acceptance가 근거로 가리키는 절(PR 본문의 절 등)',
  ],
  'Runner 환경': [
    '`bash`로 실행합니다',
    '`${PIPESTATUS[0]}`',
    '`node --version`',
    '오래 도는 단계에는 시간 상한을 두고',
    '회차마다 새 경로에 써서 이미 있는 log를 덮지 않으며',
    '지우는 대신 새 디렉터리를 씁니다',
  ],
  'Runner 기록 내용': [
    '명령·exit·출력 경로와 log의 결과 조각만',
    'finding 위치나 결론 문장을 넣지 않습니다',
  ],
  '자체 정합 점검': [
    'blocking 전부를 한 번에 고치고',
    '문장 단위',
    '`rg -U`',
    '저장소 전체 tracked 경로',
    '결정적 검사를 통과시킨 뒤',
    '검색 exit 줄은 명령 이름을 붙여 적습니다(`rg exit=1`)',
    '줄 전체 `exit=` 줄은 묶음의 끝 exit에만 씁니다',
    '`repeated-step-exit-hidden`',
    '바뀐 결정·관계마다 그것을 말하는 문장 목록',
    '다른 언어로 적은 code 주석',
    '그 값을 소유한다고 적은 문서',
    '그 글을 읽는 test',
    '줄마다 판정한 기록',
    '검색 exit 0을 판정으로 쓰지 않습니다',
    '`rg --no-ignore --hidden`',
    '수정 전 판처럼 결과가 있어야 하는 대상',
    '`control rg exit=0`',
    '`absence-without-control`',
    '`git grep -E`의 `\\b`',
    '`git grep -P`',
  ],
  '새 파일': ['stage하지 않습니다', '저장소 밖 독립 clone'],
  'RED 사유': ['red-reason-check.mjs', 'Vitest'],
  인용: ['citation-check.mjs'],
  '계획 리뷰 등급': ['plan-shape-check.mjs --revision', 'plan-reference-check.mjs'],
  Mutation: [
    'mutation-harness.mjs',
    '연산자 mutation sweep',
    'survivor 목록을 runner 기록에',
    '동등을 보이는 재현 입력과 출력',
  ],
  'Runner 기록 검사': [
    'runner-log-check.mjs --evidence <JSON> --header "<logHeader>"',
    '위치 인자는 받지 않',
    '`suggestion`',
    // OSS-RL P5 goal 2: both hosts name the carried record field and the reason a run without a basis gives.
    '`carriedFrom`',
    '`carry-basis-missing`',
  ],
};

// The section from its heading to the next `## ` heading: lead bullets (`- <name>: …`) before the first numbered step
// and numbered steps (`<n>. <name>: …`), each with its name and its text folded to one line.
export function dispatchSection(text) {
  const start = text.indexOf('\n## Dispatch 전 단계\n');
  if (start < 0) return null;
  const rest = text.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  const body = end < 0 ? rest : rest.slice(0, end);
  const [intro, ...steps] = body.split(/\n(?=\d+\. )/u);
  const item = (block, marker) => ({
    name: new RegExp(`^${marker}([^:\\n]+):`, 'u').exec(block)?.[1] ?? null,
    text: block.replace(/\s+/gu, ' '),
  });
  return {
    intro: intro.split(/\n(?=- )/u)[0].replace(/\s+/gu, ' '),
    bullets: intro
      .split(/\n(?=- )/u)
      .slice(1)
      .map((block) => item(block, '- ')),
    steps: steps.map((block) => item(block, '\\d+\\. ')),
  };
}

// Missing sentences per bullet or step of a parsed section, as `<name>: <sentence>`.
export function missingDispatchPhrases(section) {
  const missing = [];
  for (const entry of [...section.bullets, ...section.steps])
    for (const phrase of DISPATCH_PHRASES[entry.name] ?? [])
      if (!entry.text.includes(phrase)) missing.push(`${entry.name}: ${phrase}`);
  return missing;
}
