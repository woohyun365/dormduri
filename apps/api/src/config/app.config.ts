import { registerAs } from '@nestjs/config';
import { readNumberEnv } from './env.helpers.js';

export const DEFAULT_NODE_ENV = 'development';
export const DEFAULT_PORT = 4000;

export default registerAs('app', () => {
  const nodeEnv = process.env.NODE_ENV?.trim() || DEFAULT_NODE_ENV;

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: readNumberEnv(process.env, 'PORT', DEFAULT_PORT, { min: 1 }),
  };
});
