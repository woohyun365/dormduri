export class SeasonParticipationMutationError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SeasonParticipationMutationError';
  }
}

async function deregisterCurrentSeasonParticipation(): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/seasons/current/participation/deregister', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new SeasonParticipationMutationError('Season participation deregistration failed.');
  }

  if (!response.ok) {
    throw new SeasonParticipationMutationError(
      'Season participation deregistration returned an error status.',
      response.status,
    );
  }
}

export const seasonParticipationApi = {
  deregisterCurrentSeasonParticipation,
};
