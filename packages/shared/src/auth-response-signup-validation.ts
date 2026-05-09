import { z } from 'zod';
import { genericErrorResponseSchema } from './auth-response-base.js';

export const signupProfileValidationFieldErrorsSchema = z
  .strictObject({
    email: z.string().optional(),
    nickname: z.string().optional(),
    password: z.string().optional(),
  })
  .partial();

export const signupProfileValidationResponseSchema = genericErrorResponseSchema.extend({
  fieldErrors: signupProfileValidationFieldErrorsSchema.optional(),
});

export type SignupProfileValidationFieldErrors = z.infer<
  typeof signupProfileValidationFieldErrorsSchema
>;
export type SignupProfileValidationResponse = z.infer<typeof signupProfileValidationResponseSchema>;
