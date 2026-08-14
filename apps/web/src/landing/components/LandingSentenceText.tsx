interface LandingSentenceTextProps {
  text: string;
  className?: string;
}

function splitSentences(text: string): string[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed.split(/(?<=[.!?])\s+/u).filter(Boolean);
}

export function LandingSentenceText({ text, className }: LandingSentenceTextProps) {
  const sentences = splitSentences(text);

  return (
    <p className={className}>
      {sentences.map((sentence, index) => (
        <span key={`${sentence}-${index}`}>
          {sentence}
          {index < sentences.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  );
}
