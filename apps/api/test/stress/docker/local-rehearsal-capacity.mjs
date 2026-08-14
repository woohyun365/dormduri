#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const DEFAULT_TARGET_CPUS = 2;
const DEFAULT_TARGET_MEMORY_MIB = 4096;
const DEFAULT_MEMORY_TOLERANCE_MIB = 256;

export function readDockerEngineCapacity() {
  const result = spawnSync('docker', ['info', '--format', '{{json .}}'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('Docker engine 정보를 읽지 못했어요. Docker가 실행 중인지 확인해 주세요.');
  }

  const info = JSON.parse(String(result.stdout || '{}'));
  return {
    cpus: Number(info.NCPU),
    memoryBytes: Number(info.MemTotal),
    operatingSystem: String(info.OperatingSystem || 'unknown'),
    architecture: String(info.Architecture || 'unknown'),
  };
}

export function assessLocalRehearsalCapacity(capacity, options = {}) {
  const targetCpus = positiveNumber(options.targetCpus, DEFAULT_TARGET_CPUS);
  const targetMemoryMiB = positiveNumber(options.targetMemoryMiB, DEFAULT_TARGET_MEMORY_MIB);
  const memoryToleranceMiB = positiveNumber(
    options.memoryToleranceMiB,
    DEFAULT_MEMORY_TOLERANCE_MIB,
  );
  const actualMemoryMiB = Math.round(capacity.memoryBytes / MIB);
  const minimumMemoryMiB = targetMemoryMiB - memoryToleranceMiB;
  const maximumMemoryMiB = targetMemoryMiB + memoryToleranceMiB;
  const failures = [];

  if (capacity.cpus !== targetCpus) {
    failures.push(`Docker CPU가 ${capacity.cpus}개예요. ${targetCpus}개로 제한해야 해요.`);
  }
  if (actualMemoryMiB < minimumMemoryMiB || actualMemoryMiB > maximumMemoryMiB) {
    failures.push(
      `Docker memory가 ${actualMemoryMiB}MiB예요. ${targetMemoryMiB}MiB(±${memoryToleranceMiB}MiB)로 제한해야 해요.`,
    );
  }

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    targetCpus,
    targetMemoryMiB,
    memoryToleranceMiB,
    actualCpus: capacity.cpus,
    actualMemoryMiB,
    operatingSystem: capacity.operatingSystem,
    architecture: capacity.architecture,
    failures,
  };
}

export function assessCurrentDockerEngine() {
  return assessLocalRehearsalCapacity(readDockerEngineCapacity());
}

export function formatLocalRehearsalGuidance(assessment) {
  const lines = [
    ...assessment.failures,
    'Docker engine 전체 resource를 제한한 뒤 다시 실행해 주세요.',
  ];
  if (/orbstack/iu.test(assessment.operatingSystem)) {
    lines.push(
      `OrbStack 예시: orb config set cpu ${assessment.targetCpus}`,
      `OrbStack 예시: orb config set memory_mib ${assessment.targetMemoryMiB}`,
      '설정을 적용한 뒤 OrbStack을 재시작하고 docker info를 다시 확인해 주세요.',
    );
  } else {
    lines.push(
      `Docker Desktop 또는 Linux VM을 CPU ${assessment.targetCpus}, memory ${assessment.targetMemoryMiB}MiB로 설정해 주세요.`,
    );
  }
  return lines.join('\n');
}

function positiveNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Local rehearsal resource 값이 올바르지 않아요: ${value}`);
  }
  return parsed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const assessment = assessCurrentDockerEngine();
    console.log(JSON.stringify(assessment, null, 2));
    if (assessment.status !== 'passed') {
      console.error(formatLocalRehearsalGuidance(assessment));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
