import { registerAuthServiceCases } from '../auth-service.integration-cases.js';
import { registerAuthUserTransactionCases } from '../auth-users-transaction.integration-cases.js';

registerAuthUserTransactionCases('registration');
registerAuthServiceCases('registration');
