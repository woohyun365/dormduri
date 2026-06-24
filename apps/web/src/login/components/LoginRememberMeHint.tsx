interface LoginRememberMeHintProps {
  visible: boolean;
}

export function LoginRememberMeHint({ visible }: LoginRememberMeHintProps) {
  if (!visible) return null;

  return (
    <p className="ml-6 mt-1.5 text-xs text-[var(--knu-text-tertiary)]">
      브라우저를 닫아도 로그인 상태가 유지됩니다
    </p>
  );
}
