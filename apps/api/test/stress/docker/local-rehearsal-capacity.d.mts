export interface DockerEngineCapacity {
  readonly cpus: number;
  readonly memoryBytes: number;
  readonly operatingSystem: string;
  readonly architecture: string;
}

export interface LocalRehearsalCapacityOptions {
  readonly targetCpus?: number | string;
  readonly targetMemoryMiB?: number | string;
  readonly memoryToleranceMiB?: number | string;
}

export interface LocalRehearsalCapacityAssessment {
  readonly status: 'passed' | 'failed';
  readonly targetCpus: number;
  readonly targetMemoryMiB: number;
  readonly memoryToleranceMiB: number;
  readonly actualCpus: number;
  readonly actualMemoryMiB: number;
  readonly operatingSystem: string;
  readonly architecture: string;
  readonly failures: readonly string[];
}

export function readDockerEngineCapacity(): DockerEngineCapacity;

export function assessLocalRehearsalCapacity(
  capacity: DockerEngineCapacity,
  options?: LocalRehearsalCapacityOptions,
): LocalRehearsalCapacityAssessment;

export function assessCurrentDockerEngine(): LocalRehearsalCapacityAssessment;

export function formatLocalRehearsalGuidance(assessment: LocalRehearsalCapacityAssessment): string;
