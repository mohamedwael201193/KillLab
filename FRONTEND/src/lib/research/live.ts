export { draftSpec, mergeCompiledDraft } from "./draft-spec";
export type { DraftSpec } from "./draft-spec";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function killlab(method: string, path: string, body?: unknown, idempotencyKey?: string) {
  const response = await fetch(`/api/killlab${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code || `http_${response.status}`);
  }
  return data;
}
