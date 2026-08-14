import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(CURRENT_DIR, '../../../prisma/schema.prisma');
const SQL_DIR_PATH = path.resolve(CURRENT_DIR, '../../../prisma/sql');

describe('updatedAt ownership coverage', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');

  it('모든 updatedAt 필드는 Prisma @updatedAt로 선언된다', () => {
    const modelBlocks = Array.from(
      schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g),
      (match) => ({
        modelName: match[1]!,
        body: match[2]!,
      }),
    );

    const updatedAtModels = modelBlocks
      .filter((block) => /^\s*updatedAt\s+DateTime/m.test(block.body))
      .map((block) => ({
        modelName: block.modelName,
        hasPrismaUpdatedAt: /^\s*updatedAt\s+DateTime[^\n]*@updatedAt/m.test(block.body),
      }));

    const uncovered = updatedAtModels
      .filter((item) => !item.hasPrismaUpdatedAt)
      .map((item) => item.modelName);

    expect(uncovered).toEqual([]);
  });

  it('updatedAt 모델을 쓰는 raw SQL은 SQL이 직접 updatedAt를 세팅한다', () => {
    const updatedAtModels = new Set(
      Array.from(schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g))
        .filter((match) => /^\s*updatedAt\s+DateTime/m.test(match[2]!))
        .map((match) => match[1]!),
    );
    const missingUpdatedAtWrites = readdirSync(SQL_DIR_PATH).flatMap((fileName) => {
      const content = readFileSync(path.join(SQL_DIR_PATH, fileName), 'utf8');
      const writtenModels = Array.from(
        content.matchAll(/(?:INSERT\s+INTO|UPDATE)\s+"(\w+)"/g),
        (match) => match[1]!,
      ).filter((modelName) => updatedAtModels.has(modelName));

      return writtenModels.length > 0 && !content.includes('"updatedAt"') ? [fileName] : [];
    });

    expect(missingUpdatedAtWrites).toEqual([]);
  });
});
