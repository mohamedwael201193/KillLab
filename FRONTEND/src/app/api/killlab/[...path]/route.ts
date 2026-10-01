import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function proxy(request: NextRequest, path: string[]) {
  const base = process.env.BACKEND_PUBLIC_URL;
  const token = process.env.KILLAB_API_TOKEN;
  if (!base || !token) {
    return NextResponse.json(
      { error: { code: "proxy_unconfigured", message: "Backend proxy is not configured." } },
      { status: 503 },
    );
  }
  const target = new URL(`${base.replace(/\/$/, "")}/${path.join("/")}`);
  target.search = request.nextUrl.search;
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const idem = request.headers.get("idempotency-key");
  if (idem) headers.set("Idempotency-Key", idem);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "upstream_unavailable", message: "The research API did not answer in time." } },
      { status: 503 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Ctx) {
  return proxy(request, (await context.params).path);
}
export async function POST(request: NextRequest, context: Ctx) {
  return proxy(request, (await context.params).path);
}
export async function PUT(request: NextRequest, context: Ctx) {
  return proxy(request, (await context.params).path);
}
