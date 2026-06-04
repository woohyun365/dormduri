import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase();
export const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);
export const passwordSchema = z.string().min(1);
export const nicknameSchema = z.string().trim().min(1);
