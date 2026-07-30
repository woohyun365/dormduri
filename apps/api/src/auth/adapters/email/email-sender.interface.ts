export interface VerificationCodeMailInput {
  email: string;
  code: string;
  expiresInSeconds: number;
  correlationId?: string;
}

export interface PasswordResetMailInput {
  email: string;
  code: string;
  expiresInSeconds: number;
  correlationId?: string;
}

export interface PasswordChangedMailInput {
  email: string;
  correlationId?: string;
}

export interface EmailSendReceipt {
  providerMessageId: string | null;
}

export interface EmailSender {
  sendVerificationCode(input: VerificationCodeMailInput): Promise<EmailSendReceipt>;
  sendPasswordResetCode(input: PasswordResetMailInput): Promise<EmailSendReceipt>;
  sendPasswordChanged(input: PasswordChangedMailInput): Promise<EmailSendReceipt>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export const EMAIL_SENDER_DELEGATE = Symbol('EMAIL_SENDER_DELEGATE');
