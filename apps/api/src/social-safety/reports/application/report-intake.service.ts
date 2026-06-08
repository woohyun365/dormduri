import { Injectable } from '@nestjs/common';
import type { CreateReportRequest, CreateReportResponse } from '@repo/shared/social-safety/report';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { CreateReportCommand } from '../commands/create-report.command.js';

@Injectable()
export class ReportIntakeService {
  constructor(private readonly createReportCommand: CreateReportCommand) {}

  create(
    authUser: AuthenticatedUserContext,
    request: CreateReportRequest,
  ): Promise<CreateReportResponse> {
    return this.createReportCommand.execute({ authUser, request });
  }
}
