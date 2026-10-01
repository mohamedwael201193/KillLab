export { draftSpec, mergeCompiledDraft } from "./draft-spec";
export type { DraftSpec } from "./draft-spec";
import { failureMessage, isTransient, retryDelayMs } from "./reliability";

export { failureMessage, isTransient, retryDelayMs };

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(failureMessage(status, code));
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

const inflight = new Map<string, Promise<unknown>>();

async function once(method: string, path: string, body: unknown, idempotencyKey?: string, signal?: AbortSignal) {
  const response = await fetch(`/api/killlab${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code || `http_${response.status}`);
  }
  return data;
}

export async function killlab(method: string, path: string, body?: unknown, idempotencyKey?: string, signal?: AbortSignal) {
  const key = `${method} ${path}`;
  if (method === "GET") {
    const pending = inflight.get(key);
    if (pending) return pending;
  }
  const run = (async () => {
    let last: unknown;
    const attempts = method === "GET" ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await once(method, path, body, idempotencyKey, signal);
      } catch (err) {
        last = err;
        const status = err instanceof ApiError ? err.status : 0;
        if (signal?.aborted || method !== "GET" || !isTransient(status) || attempt === attempts - 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
      }
    }
    throw last;
  })();
  if (method === "GET") {
    inflight.set(key, run);
    void run.finally(() => {
      if (inflight.get(key) === run) inflight.delete(key);
    });
  }
  return run;
}
