/** ISO-8601 datetime string as serialised by the API. */
export type ISODateString = string;

/** Paginated list envelope (PRP contract #5). Query params: `?page=1&pageSize=20`. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** One entry of a FastAPI / Pydantic validation error list. */
export interface ApiValidationErrorItem {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

/** Error body returned by every API error (PRP contract #4). */
export interface ApiError {
  detail: string;
  code: string;
  errors?: ApiValidationErrorItem[];
}
