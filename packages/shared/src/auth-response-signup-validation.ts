import { z } from 'zod';
import { genericErrorResponseSchema } from './auth-response-base.js';

export const signupDraftValidationFieldErrorsSchema = z
  .strictObject({
    email: z.string().optional(),
    nickname: z.string().optional(),
    password: z.string().optional(),
  })
  .partial();

export const signupDraftValidationResponseSchema = genericErrorResponseSchema.extend({
  fieldErrors: signupDraftValidationFieldErrorsSchema.optional(),
});

export type SignupDraftValidationFieldErrors = z.infer<
  typeof signupDraftValidationFieldErrorsSchema
>;
export type SignupDraftValidationResponse = z.infer<typeof signupDraftValidationResponseSchema>;
