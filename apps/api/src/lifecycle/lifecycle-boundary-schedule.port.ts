export const BOUNDARY_JOB_PREFIX = 'lifecycle-boundary';

export interface LifecycleBoundaryJob {
  name: string;
  runAt: Date;
}

export interface LifecycleBoundarySchedulePort {
  buildBoundaryJobs(referenceNow: Date): Promise<LifecycleBoundaryJob[]>;
}
