/**
 * Alias module matching the PRP name (`services/apiClient.ts`).
 * The implementation lives in `services/api.ts`; import from either.
 */
export {
  api as apiClient,
  api,
  API_BASE_URL,
  getErrorCode,
  getErrorMessage,
  getErrorStatus,
  setAuthFailureHandler,
} from './api';
export type { ApiAxiosError } from './api';
