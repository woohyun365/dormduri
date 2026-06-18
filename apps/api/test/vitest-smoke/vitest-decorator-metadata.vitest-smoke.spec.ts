import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

@Injectable()
class VitestSmokeDependency {
  getValue() {
    return 'vitest-nest-smoke';
  }
}

@Injectable()
class VitestSmokeService {
  constructor(private readonly dependency: VitestSmokeDependency) {}

  read() {
    return this.dependency.getValue();
  }
}

describe('Vitest Nest/SWC smoke', () => {
  it('preserves decorator metadata for TestingModule dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [VitestSmokeDependency, VitestSmokeService],
    }).compile();

    const service = moduleRef.get(VitestSmokeService);

    expect(service.read()).toBe('vitest-nest-smoke');
  });
});
