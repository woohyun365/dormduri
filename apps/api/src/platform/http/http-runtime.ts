import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import type httpConfig from '../../config/http.config.js';

export type HttpRuntimeSettings = ConfigType<typeof httpConfig>;

export interface HttpCorsOptions {
  readonly origin: string[];
  readonly credentials: false;
  readonly methods: string[];
  readonly allowedHeaders: string[];
  readonly exposedHeaders: string[];
  readonly optionsSuccessStatus: 204;
}

export function configureHttpRuntime(
  app: INestApplication,
  httpSettings: HttpRuntimeSettings,
): void {
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', httpSettings.trustProxy);
  app.use(helmet());
  app.use(cookieParser());

  const corsOptions = buildHttpCorsOptions(httpSettings.corsAllowedOrigins);
  if (corsOptions !== null) {
    app.enableCors(corsOptions);
  }
}

export function buildHttpCorsOptions(allowedOrigins: readonly string[]): HttpCorsOptions | null {
  if (allowedOrigins.length === 0) {
    return null;
  }

  return {
    origin: [...allowedOrigins],
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 204,
  };
}
