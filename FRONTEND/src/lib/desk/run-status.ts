export function runStatusLine(status: string | undefined): string {
  if (status === "running" || status === "queued") return "Engine running";
  if (status === "succeeded" || status === "untestable") return "Engine finished";
  if (status === "failed") return "Run failed";
  return "Waiting for the engine";
}
