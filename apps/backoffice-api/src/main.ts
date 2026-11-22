import 'reflect-metadata';
import { createBackofficeApplication } from './app.factory.js';
import {
  BackofficeSettingsError,
  loadBackofficeSettings,
} from './platform/config/backoffice-settings.js';

async function bootstrap(): Promise<void> {
  const settings = loadBackofficeSettings(process.env);
  const app = await createBackofficeApplication(settings);
  await app.listen(settings.port);
}

try {
  await bootstrap();
} catch (error) {
  const fields = error instanceof BackofficeSettingsError ? error.fields : [];
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      event: 'backoffice_api_bootstrap_failed',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      fields,
    })}\n`,
  );
  process.exitCode = 1;
}
