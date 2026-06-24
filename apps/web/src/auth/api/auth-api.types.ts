export type RequestJsonResult<T> = {
  status: number;
  data: T;
  retryAfterSeconds?: number;
};

export type AuthClientErrorBody = {
  success?: boolean;
  error?: string;
  message?: string;
  retryAfterSeconds?: number;
  code?: string;
};

export type AuthCodeRequestResult = {
  success: boolean;
  error?: string;
  retryAfterSeconds?: number;
};
