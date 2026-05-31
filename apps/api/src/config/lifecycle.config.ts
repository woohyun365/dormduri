import { registerAs } from '@nestjs/config';
import { readBooleanEnv, readNumberEnv } from './env.helpers.js';

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';

export const DEFAULT_LIFECYCLE_SWEEP_ENABLED = nodeEnv !== 'test';
export const DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS =
  nodeEnv === 'production' ? 5 * 60 * 1000 : 60 * 1000;

export default registerAs('lifecycle', () => ({
  sweepEnabled: readBooleanEnv(
    process.env,
    'LIFECYCLE_SWEEP_ENABLED',
    DEFAULT_LIFECYCLE_SWEEP_ENABLED,
  ),
  sweepIntervalMs: readNumberEnv(
    process.env,
    'LIFECYCLE_SWEEP_INTERVAL_MS',
    DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS,
    { min: 1_000 },
  ),
}));
