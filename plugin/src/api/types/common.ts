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
export const API_ERRORS = {
  SUCCESS: 0,
  INVALID_REQUEST: -100,
  NOT_LOGGED_IN: -101,
  VISIT_TOO_FREQUENTLY: -110,
  LOGIN_REQUIRED: 10001,
  DATA_NOT_PUBLIC: 10102,
  ALREADY_CLAIMED: -5003,
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
 * Check if an error is a rate-limit error from HoYoLAB
 */
export function isRateLimitError(error: unknown): error is HoyolabApiError {
  if (!(error instanceof HoyolabApiError)) return false;
  return error.retcode === API_ERRORS.VISIT_TOO_FREQUENTLY;
}

/**
 * Check if API response indicates success
 */
export function isSuccess<T>(response: ApiResponse<T>): boolean {
  return response.retcode === API_ERRORS.SUCCESS;
}
