import { runReferenceSeed } from './common/reference-seed-runner.js';
import { seedCollegeReferenceData } from './colleges/seed-college-reference-data.js';
import { seedDormitoryReferenceData } from './dormitories/seed-dormitory-reference-data.js';
import { seedModerationReferenceData } from './moderation/seed-moderation-reference-data.js';

runReferenceSeed('all', async (client) => {
  const dormitories = await seedDormitoryReferenceData(client);
  const colleges = await seedCollegeReferenceData(client);
  const moderation = await seedModerationReferenceData(client);

  return {
    dormitories: dormitories.dormitories,
    matchingDormitories: dormitories.matchingDormitories,
    colleges: colleges.colleges,
    moderationTerms: moderation.moderationTerms,
    deactivatedModerationTerms: moderation.deactivatedModerationTerms,
  };
}).catch((error) => {
  console.error('[reference-seed] all failed', error);
  process.exitCode = 1;
});
