import { runReferenceSeed } from '../common/reference-seed-runner.js';
import { seedModerationReferenceData } from './seed-moderation-reference-data.js';

runReferenceSeed('moderation', seedModerationReferenceData).catch((error) => {
  console.error('[reference-seed] moderation failed', error);
  process.exitCode = 1;
});
