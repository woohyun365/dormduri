import type { LifecycleSweepTaskName, LifecycleSweepTaskResults } from './lifecycle-sweep.types.js';

export interface LifecycleSweepTaskPort<
  TName extends LifecycleSweepTaskName = LifecycleSweepTaskName,
> {
  readonly name: TName;
  readonly order: number;
  run(now: Date): Promise<LifecycleSweepTaskResults[TName]>;
}
