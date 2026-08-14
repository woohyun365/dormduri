import type { AuthFeedbackVariant } from './AuthFeedbackStrip';

export interface AuthActionFeedbackState {
  variant: AuthFeedbackVariant;
  title: string;
  description?: string;
}
