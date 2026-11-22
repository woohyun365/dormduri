import { Module } from '@nestjs/common';
import { RoleAssignmentStore } from './role-assignment.store.js';

/** Role assignment writes; below both the identity and the approval modules. */
@Module({
  providers: [{ provide: RoleAssignmentStore, useValue: new RoleAssignmentStore() }],
  exports: [RoleAssignmentStore],
})
export class AccessRolesModule {}
