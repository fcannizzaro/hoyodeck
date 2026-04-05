/**
 * Common API response wrapper
 */
export interface ApiResponse<T> {
  retcode: number;
  message: string;
  data: T;
}

/**
 * API error codes
 */
const API_ERRORS = {
  SUCCESS: 0,
  INVALID_REQUEST: -100,
  NOT_LOGGED_IN: -101,
  LOGIN_REQUIRED: 10001,
} as const;

/**
 * Custom error class for HoYoLAB API errors
 */
export class HoyolabApiError extends Error {
  constructor(
    public readonly retcode: number,
    message: string,
  ) {
    super(message);
    this.name = "HoyolabApiError";
  }
}

/**
 * Check if an error is an auth-related API error (expired/invalid tokens)
 */
export function isAuthError(error: unknown): error is HoyolabApiError {
  if (!(error instanceof HoyolabApiError)) return false;
  return (
    error.retcode === API_ERRORS.INVALID_REQUEST ||
    error.retcode === API_ERRORS.NOT_LOGGED_IN ||
    error.retcode === API_ERRORS.LOGIN_REQUIRED
  );
}

/**
 * Check if API response indicates success
 */
export function isSuccess<T>(response: ApiResponse<T>): boolean {
  return response.retcode === API_ERRORS.SUCCESS;
}
