import { runReferenceSeed } from './common/reference-seed-runner.js';
import { seedCollegeReferenceData } from './colleges/seed-college-reference-data.js';
import { seedDormitoryReferenceData } from './dormitories/seed-dormitory-reference-data.js';

runReferenceSeed('all', async (client) => {
  const dormitories = await seedDormitoryReferenceData(client);
  const colleges = await seedCollegeReferenceData(client);

  return {
    dormitories: dormitories.dormitories,
    matchingDormitories: dormitories.matchingDormitories,
    colleges: colleges.colleges,
  };
}).catch((error) => {
  console.error('[reference-seed] all failed', error);
  process.exitCode = 1;
});
