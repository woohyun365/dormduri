import { Controller, Get } from '@nestjs/common';
import { ROLE_PERMISSIONS } from '../permissions.js';
import { SessionRoute } from '../route-access.js';

/** The role catalog is code; the screen shows what each role grants. */
@Controller('access/roles')
export class RolesController {
  @Get()
  @SessionRoute()
  catalog() {
    return {
      roles: Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
        role,
        permissions: [...permissions],
      })),
    };
  }
}
