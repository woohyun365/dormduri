export type SignupNicknameValidationState =
  | { status: 'unchecked' }
  | { status: 'checking'; nicknameKey: string }
  | { status: 'available'; nicknameKey: string; message: string }
  | { status: 'rejected'; nicknameKey: string | null; message: string }
  | { status: 'unavailable'; nicknameKey: string; message: string }
  | { status: 'expired'; nicknameKey: string; message: string }
  | { status: 'stale'; message: string };

export const INITIAL_SIGNUP_NICKNAME_VALIDATION_STATE: SignupNicknameValidationState = {
  status: 'unchecked',
};
