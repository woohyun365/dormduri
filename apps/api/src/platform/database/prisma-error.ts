import { Prisma } from '../../generated/prisma/client.js';

type PrismaKnownRequestLike = Prisma.PrismaClientKnownRequestError & {
  code: string;
  meta?: {
    target?: unknown;
  };
};

export function isPrismaKnownRequestError(
  error: unknown,
  code: string,
): error is PrismaKnownRequestLike {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === code) ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code) ||
    (code === 'P2002' &&
      error instanceof Error &&
      error.message.includes('Unique constraint failed'))
  );
}

export function prismaErrorTargetIncludes(error: PrismaKnownRequestLike, field: string) {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((item) => String(item).includes(field));
  }
  if (typeof target === 'string') {
    return target.includes(field);
  }
  return error instanceof Error && error.message.includes(field);
}
