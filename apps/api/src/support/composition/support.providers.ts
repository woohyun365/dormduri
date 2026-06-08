import type { Provider } from '@nestjs/common';
import { SupportService } from '../application/support.service.js';
import { AppendSupportTicketMessageCommand } from '../commands/append-support-ticket-message.command.js';
import { CreateSupportTicketCommand } from '../commands/create-support-ticket.command.js';
import { ReplySupportTicketCommand } from '../commands/reply-support-ticket.command.js';
import { ResolveSupportTicketCommand } from '../commands/resolve-support-ticket.command.js';
import { SupportNotificationService } from '../notifications/support-notification.service.js';
import { SupportFaqQuery } from '../queries/support-faq.query.js';
import { SupportTicketDetailQuery } from '../queries/support-ticket-detail.query.js';
import { SupportTicketListQuery } from '../queries/support-ticket-list.query.js';
import { SupportFaqRepository } from '../repositories/support-faq.repository.js';
import { SupportTicketRepository } from '../repositories/support-ticket.repository.js';

export const SUPPORT_PROVIDERS: Provider[] = [
  SupportService,
  CreateSupportTicketCommand,
  AppendSupportTicketMessageCommand,
  ReplySupportTicketCommand,
  ResolveSupportTicketCommand,
  SupportTicketListQuery,
  SupportTicketDetailQuery,
  SupportFaqQuery,
  SupportTicketRepository,
  SupportFaqRepository,
  SupportNotificationService,
];
