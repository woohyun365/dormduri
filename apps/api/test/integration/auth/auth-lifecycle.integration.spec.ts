import { registerAuthServiceCases } from './auth-service.integration-cases.js';
import { registerAuthUserTransactionCases } from './auth-users-transaction.integration-cases.js';

registerAuthServiceCases(['registration', 'credentials', 'sessions']);
registerAuthUserTransactionCases(['registration', 'credentials']);
