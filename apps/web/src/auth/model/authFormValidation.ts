export function validatePasswordConfirm(password: string, confirm: string): string {
  if (password !== confirm) return '비밀번호가 일치하지 않습니다.';
  return '';
}
