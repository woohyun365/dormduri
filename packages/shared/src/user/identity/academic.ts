import { z } from 'zod';
import { collegeCodeSchema } from '../../college-contract.js';
import { profileBirthYearSchema } from '../../profile-contract-fields.js';

export const academicIdentityEditUnavailableReasonSchema = z.enum([
  'CURRENT_SEASON_REGISTRATION_LOCK',
  'BIRTH_YEAR_LOCKED_AFTER_REGISTRATION',
  'COLLEGE_CHANGE_ALLOWANCE_EXHAUSTED',
  'ACADEMIC_CORRECTION_CYCLE_UNAVAILABLE',
]);

export const userAcademicIdentitySchema = z.strictObject({
  collegeCode: collegeCodeSchema,
  birthYear: profileBirthYearSchema,
});

export type AcademicIdentityEditUnavailableReason = z.infer<
  typeof academicIdentityEditUnavailableReasonSchema
>;
export type UserAcademicIdentity = z.infer<typeof userAcademicIdentitySchema>;
