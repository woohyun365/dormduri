import { runReferenceSeed } from '../common/reference-seed-runner.js';
import { seedCollegeReferenceData } from './seed-college-reference-data.js';

runReferenceSeed('colleges', seedCollegeReferenceData).catch((error) => {
  console.error('[reference-seed] colleges failed', error);
  process.exitCode = 1;
});
