import { BOUNDARY_JOB_PREFIX } from '../lifecycle-boundary-schedule.port.js';
import {
  SeasonBoundaryScheduleAdapter,
  toBoundaryJobsForSeason,
} from './season-boundary-schedule.adapter.js';

describe('SeasonBoundaryScheduleAdapter', () => {
  const prisma = {
    season: {
      findMany: jest.fn(),
    },
  };

  const adapter = new SeasonBoundaryScheduleAdapter(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('미래 경계 시점만 boundary job으로 생성한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        preparationStartDate: new Date('2026-05-10T00:00:00.000Z'),
        matchingStartDate: new Date('2026-05-20T00:00:00.000Z'),
        seasonEndDate: new Date('2026-05-30T00:00:00.000Z'),
        dormitoryOperations: [
          {
            dormitoryId: 'dasan',
            roomSelectionDate: new Date('2026-05-25T00:00:00.000Z'),
          },
        ],
      },
    ]);

    const jobs = await adapter.buildBoundaryJobs(new Date('2026-05-15T00:00:00+09:00'));

    expect(jobs.map((job) => job.name)).toEqual([
      `${BOUNDARY_JOB_PREFIX}:season-1:matching-start`,
      `${BOUNDARY_JOB_PREFIX}:season-1:season-end-next-day`,
      `${BOUNDARY_JOB_PREFIX}:season-1:room-selection-next-day:dasan`,
    ]);
  });

  it('toBoundaryJobsForSeason은 KST 다음날 경계 이름을 유지한다', () => {
    const jobs = toBoundaryJobsForSeason(
      {
        id: 'season-2',
        preparationStartDate: '2026-05-01',
        matchingStartDate: '2026-05-10',
        seasonEndDate: '2026-05-30',
        dormitoryOperations: [{ dormitoryId: 'saerom', roomSelectionDate: '2026-05-20' }],
      },
      new Date('2026-04-30T00:00:00+09:00'),
    );

    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: `${BOUNDARY_JOB_PREFIX}:season-2:preparation-start`,
        }),
        expect.objectContaining({
          name: `${BOUNDARY_JOB_PREFIX}:season-2:season-end-next-day`,
        }),
        expect.objectContaining({
          name: `${BOUNDARY_JOB_PREFIX}:season-2:room-selection-next-day:saerom`,
        }),
      ]),
    );
  });
});
