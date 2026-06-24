interface LoginRememberMeHintProps {
  visible: boolean;
}

export function LoginRememberMeHint({ visible }: LoginRememberMeHintProps) {
  if (!visible) return null;

  return (
    <p className="ml-6 mt-1.5 text-xs text-[var(--knu-text-tertiary)]">
      개인 기기에서만 사용해주세요. 로그인 유지 선택 시 최대 7일 동안 다시 로그인하지 않아도 됩니다.
    </p>
  );
}
