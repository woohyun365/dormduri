import type { ConfigType } from '@nestjs/config';
import {
  describeRuntimeEnvironmentPreparationFailure,
  prepareRuntimeEnvironment,
} from './platform/runtime/bootstrap/prepare-runtime-environment.js';

async function bootstrap() {
  await prepareRuntimeEnvironment(process.env);
  const [
    { NestFactory },
    { AppModule },
    { default: appConfig },
    { default: httpConfig },
    { AppLoggerService },
    { configureHttpRuntime },
    { default: chatRealtimeConfig },
    { ChatRealtimeIoAdapter },
  ] = await Promise.all([
    import('@nestjs/core'),
    import('./app.module.js'),
    import('./platform/runtime/app.config.js'),
    import('./platform/http/http.config.js'),
    import('./platform/observability/logging/app-logger.service.js'),
    import('./platform/http/http-runtime.js'),
    import('./chat/realtime/chat-realtime.config.js'),
    import('./chat/realtime/chat-realtime-io.adapter.js'),
  ]);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  try {
    app.useLogger(app.get(AppLoggerService));
    const appSettings = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
    const httpSettings = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
    const chatSettings = app.get<ConfigType<typeof chatRealtimeConfig>>(chatRealtimeConfig.KEY);
    app.useWebSocketAdapter(new ChatRealtimeIoAdapter(app, chatSettings));
    configureHttpRuntime(app, httpSettings);
    app.enableShutdownHooks();
    await app.listen(appSettings.port);
  } catch (error) {
    await app.close();
    throw error;
  }
}

try {
  await bootstrap();
} catch (error) {
  const failure = describeRuntimeEnvironmentPreparationFailure(error);
  process.stderr.write(
    `${JSON.stringify({ level: 'error', event: 'api_bootstrap_failed', ...failure })}\n`,
  );
  process.exitCode = 1;
}
