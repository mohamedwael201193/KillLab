export function isTransient(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(4000, 400 * 2 ** attempt);
}

export function failureMessage(status: number, code: string): string {
  if (isTransient(status) || code === "upstream_unavailable") {
    return "The research API did not answer. Wait a moment, then retry.";
  }
  if (code === "validation") return "Those prices could not be compared.";
  if (code === "no_forecast") return "This run has no one-trade range, so reconciliation stays unavailable.";
  return code || `http_${status}`;
}
