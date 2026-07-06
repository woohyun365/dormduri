import {
  appendSupportTicketMessageRequestSchema,
  appendSupportTicketMessageResponseSchema,
  createSupportTicketRequestSchema,
  createSupportTicketResponseSchema,
  listSupportFaqQuerySchema,
  listSupportTicketsQuerySchema,
  supportFaqListResponseSchema,
  supportTicketDetailResponseSchema,
  supportTicketListResponseSchema,
  type AppendSupportTicketMessageRequest,
  type AppendSupportTicketMessageResponse,
  type CreateSupportTicketRequest,
  type CreateSupportTicketResponse,
  type ListSupportFaqQuery,
  type ListSupportTicketsQuery,
  type SupportFaqListResponse,
  type SupportTicketDetailResponse,
  type SupportTicketListResponse,
} from '@repo/shared/support';

export class SupportPageFetchError extends Error {
  constructor(
    public readonly code: 'SUPPORT_UPSTREAM_UNAVAILABLE' | 'SUPPORT_UPSTREAM_INVALID',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SupportPageFetchError';
  }
}

type Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

type QueryValue = string | number | boolean | null | undefined;

function buildQueryString(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new SupportPageFetchError(
      'SUPPORT_UPSTREAM_INVALID',
      'Support response is not JSON.',
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new SupportPageFetchError(
      'SUPPORT_UPSTREAM_INVALID',
      'Support response JSON is malformed.',
      response.status,
    );
  }
}

async function fetchAndParse<T>(path: string, schema: Schema<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      cache: 'no-store',
      ...init,
    });
  } catch {
    throw new SupportPageFetchError('SUPPORT_UPSTREAM_UNAVAILABLE', 'Support request failed.');
  }

  if (!response.ok) {
    throw new SupportPageFetchError(
      'SUPPORT_UPSTREAM_UNAVAILABLE',
      'Support upstream returned an error status.',
      response.status,
    );
  }

  const json = await readJson(response);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new SupportPageFetchError(
      'SUPPORT_UPSTREAM_INVALID',
      'Support response did not match the public contract.',
    );
  }
  return parsed.data;
}

function buildFaqPath(query: Partial<ListSupportFaqQuery> = { surface: 'SUPPORT_CENTER' }) {
  const parsed = listSupportFaqQuerySchema.parse(query);
  return `/api/support/faq${buildQueryString({
    category: parsed.category,
    surface: parsed.surface,
  })}`;
}

function buildTicketListPath(query: Partial<ListSupportTicketsQuery> = {}) {
  const parsed = listSupportTicketsQuerySchema.parse(query);
  return `/api/support/tickets${buildQueryString({
    status: parsed.status,
    category: parsed.category,
    cursor: parsed.cursor,
    limit: parsed.limit,
  })}`;
}

async function listFaq(
  query: Partial<ListSupportFaqQuery> = { surface: 'SUPPORT_CENTER' },
): Promise<SupportFaqListResponse> {
  return fetchAndParse(buildFaqPath(query), supportFaqListResponseSchema);
}

async function listTickets(
  query: Partial<ListSupportTicketsQuery> = {},
): Promise<SupportTicketListResponse> {
  return fetchAndParse(buildTicketListPath(query), supportTicketListResponseSchema);
}

async function getTicket(ticketId: string): Promise<SupportTicketDetailResponse> {
  return fetchAndParse(
    `/api/support/tickets/${encodeURIComponent(ticketId)}`,
    supportTicketDetailResponseSchema,
  );
}

async function createTicket(
  request: CreateSupportTicketRequest,
): Promise<CreateSupportTicketResponse> {
  const body = createSupportTicketRequestSchema.parse(request);
  return fetchAndParse('/api/support/tickets', createSupportTicketResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function appendMessage(
  ticketId: string,
  request: AppendSupportTicketMessageRequest,
): Promise<AppendSupportTicketMessageResponse> {
  const body = appendSupportTicketMessageRequestSchema.parse(request);
  return fetchAndParse(
    `/api/support/tickets/${encodeURIComponent(ticketId)}/messages`,
    appendSupportTicketMessageResponseSchema,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export const supportPageApi = {
  listFaq,
  listTickets,
  getTicket,
  createTicket,
  appendMessage,
};
