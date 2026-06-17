export interface VerificationCodeMailInput {
  email: string;
  code: string;
  expiresInSeconds: number;
}

export interface PasswordResetMailInput {
  email: string;
  code: string;
  expiresInSeconds: number;
}

export interface EmailSender {
  sendVerificationCode(input: VerificationCodeMailInput): Promise<void>;
  sendPasswordResetCode(input: PasswordResetMailInput): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export const EMAIL_SENDER_DELEGATE = Symbol('EMAIL_SENDER_DELEGATE');
