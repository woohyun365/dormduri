import { UsersService } from '../application/users.service.js';
import { USER_RETENTION_SWEEP_PORT } from '../application/ports/user-retention-sweep.port.js';
import { UserRetentionSweepService } from '../retention/user-retention-sweep.service.js';

export const USERS_PROVIDERS = [
  UsersService,
  UserRetentionSweepService,
  {
    provide: USER_RETENTION_SWEEP_PORT,
    useExisting: UserRetentionSweepService,
  },
];
