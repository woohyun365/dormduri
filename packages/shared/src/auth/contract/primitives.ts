import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../policy/constants.js';

export const emailSchema = z.email().trim().toLowerCase();
export const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);
export const passwordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);
export const opaqueAuthTokenSchema = z
  .string()
  .regex(/^v1\.[^.]+\.[A-Za-z0-9_-]{43}$/, 'opaque auth token 형식이어야 합니다.');
