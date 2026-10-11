import { AxiosError, AxiosHeaders } from 'axios';

/** Build an AxiosError carrying the API error body `{detail, code}`. */
export function apiError(status: number, detail: string, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(detail, 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { detail, code },
  });
}

/** Generous timeouts — the full suite runs many jsdom files in parallel. */
export const TEST_TIMEOUT = 30_000;
export const FIND_TIMEOUT = { timeout: 5_000 };

interface PasteUser {
  click: (element: Element) => Promise<void>;
  paste: (text: string) => Promise<void>;
}

/** Faster than `user.type` (one input event instead of one per key). */
export async function fill(user: PasteUser, element: HTMLElement, text: string): Promise<void> {
  await user.click(element);
  await user.paste(text);
}
