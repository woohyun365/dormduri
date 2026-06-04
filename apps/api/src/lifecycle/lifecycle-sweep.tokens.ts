import type { LifecycleBoundarySchedulePort } from './lifecycle-boundary-schedule.port.js';
import type { LifecycleSweepTaskPort } from './lifecycle-sweep-task.port.js';

export const LIFECYCLE_SWEEP_TASKS = Symbol('LIFECYCLE_SWEEP_TASKS');
export const LIFECYCLE_BOUNDARY_SCHEDULE = Symbol('LIFECYCLE_BOUNDARY_SCHEDULE');

export type LifecycleSweepTasksToken = typeof LIFECYCLE_SWEEP_TASKS;
export type LifecycleBoundaryScheduleToken = typeof LIFECYCLE_BOUNDARY_SCHEDULE;

export type LifecycleSweepTasksProviderValue = readonly LifecycleSweepTaskPort[];
export type LifecycleBoundaryScheduleProviderValue = LifecycleBoundarySchedulePort;
