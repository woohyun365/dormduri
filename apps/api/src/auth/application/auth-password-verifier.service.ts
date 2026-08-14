import { Injectable } from '@nestjs/common';
import { verifyPasswordHash } from '../credentials/password-hashing/password-hash.js';

@Injectable()
export class AuthPasswordVerifier {
  verifyAccountPassword(passwordHash: string, candidatePassword: string): Promise<boolean> {
    return verifyPasswordHash(passwordHash, candidatePassword, 'account_deletion_verify');
  }
}
