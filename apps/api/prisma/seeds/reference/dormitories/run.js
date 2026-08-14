import { runReferenceSeed } from '../common/reference-seed-runner.js';
import { seedDormitoryReferenceData } from './seed-dormitory-reference-data.js';

runReferenceSeed('dormitories', seedDormitoryReferenceData).catch((error) => {
  console.error('[reference-seed] dormitories failed', error);
  process.exitCode = 1;
});
