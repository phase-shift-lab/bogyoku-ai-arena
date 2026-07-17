import {
  MAX_REQUEST_BODY_BYTES,
  MIN_PUBLIC_AGGREGATE_GAMES,
  SHARED_LEARNING_SCHEMA_VERSION,
  collapseObservations,
  parseLearningEventRequest,
  toPublicAggregateRecord,
  type AggregateDatabaseRow,
} from "./domain";

interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta?: {
    changes?: number;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  MIN_AGGREGATE_GAMES?: string;
  RECEIPT_RETENTION_DAYS?: string;
  REQUIRE_RATE_LIMITER?: string;
  LEARNING_EVENT_RATE_LIMITER?: RateLimitBinding;
}

const API_PATHS = new Set(["/v1/learning/events", "/v1/learning/aggregate"]);

function parseAllowedOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const candidate of value?.split(",") ?? []) {
    const trimmed = candidate.trim();
    if (trimmed.length === 0 || trimmed === "*") {
      continue;
    }
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.origin === trimmed &&
        (parsed.protocol === "https:" || parsed.protocol === "http:")
      ) {
        origins.add(trimmed);
      }
    } catch {
      // Invalid configuration is ignored and therefore cannot widen CORS.
    }
  }
  return origins;
}

function getAllowedOrigin(request: Request, env: Env): string | null | false {
  const origin = request.headers.get("Origin");
  if (origin === null) {
    return null;
  }
  return parseAllowedOrigins(env.ALLOWED_ORIGINS).has(origin) ? origin : false;
}

function securityHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (origin !== null) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = securityHeaders(origin);
  for (const [name, value] of new Headers(extraHeaders)) {
    headers.set(name, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(
  status: number,
  code: string,
  origin: string | null,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  return jsonResponse(
    { schemaVersion: SHARED_LEARNING_SCHEMA_VERSION, error: code },
    status,
    origin,
    headers,
  );
}

function optionsResponse(origin: string): Response {
  const headers = securityHeaders(origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.delete("Content-Type");
  return new Response(null, { status: 204, headers });
}

function configuredMinimumGames(env: Env): number {
  const parsed = Number.parseInt(env.MIN_AGGREGATE_GAMES ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return MIN_PUBLIC_AGGREGATE_GAMES;
  }
  return Math.min(10_000, Math.max(MIN_PUBLIC_AGGREGATE_GAMES, parsed));
}

function configuredReceiptRetentionDays(env: Env): number {
  const parsed = Number.parseInt(env.RECEIPT_RETENTION_DAYS ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return Math.min(365, Math.max(7, parsed));
}

function isRateLimiterRequired(env: Env): boolean {
  return env.REQUIRE_RATE_LIMITER?.trim().toLowerCase() === "true";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyError("payload_too_large");
    }
  }

  if (request.body === null) {
    throw new RequestBodyError("invalid_json");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel("payload_too_large");
      throw new RequestBodyError("payload_too_large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestBodyError("invalid_json");
  }
}

async function enforceEventRateLimit(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response | null> {
  const limiter = env.LEARNING_EVENT_RATE_LIMITER;
  if (limiter === undefined) {
    return isRateLimiterRequired(env)
      ? errorResponse(503, "rate_limit_unavailable", origin)
      : null;
  }

  const connectingIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (!connectingIp) {
    return errorResponse(503, "rate_limit_unavailable", origin);
  }

  try {
    const key = await sha256Hex(`${origin}\n${connectingIp}`);
    const decision = await limiter.limit({ key });
    if (!decision.success) {
      return errorResponse(429, "rate_limited", origin, {
        "Retry-After": "60",
      });
    }
  } catch {
    return errorResponse(503, "rate_limit_unavailable", origin);
  }

  return null;
}

class RequestBodyError extends Error {
  constructor(readonly code: "payload_too_large" | "invalid_json") {
    super(code);
  }
}

async function receiveLearningEvent(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const rateLimitResponse = await enforceEventRateLimit(request, env, origin);
  if (rateLimitResponse !== null) {
    return rateLimitResponse;
  }

  const contentType = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return errorResponse(415, "unsupported_media_type", origin);
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return errorResponse(
        error.code === "payload_too_large" ? 413 : 400,
        error.code,
        origin,
      );
    }
    return errorResponse(400, "invalid_json", origin);
  }

  const parsed = parseLearningEventRequest(rawBody);
  if (!parsed.ok) {
    return errorResponse(400, parsed.code, origin);
  }

  const eventDigest = await sha256Hex(parsed.value.eventId);
  const receiptStatement = env.DB.prepare(
    "INSERT OR IGNORE INTO learning_event_receipts (event_digest) VALUES (?)",
  ).bind(eventDigest);
  const aggregateStatements = collapseObservations(
    parsed.value.observations,
  ).map((delta) =>
    env.DB.prepare(
      `INSERT INTO learning_aggregates
        (strategy, side, branch_id, games, wins, draws, score_sum)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE changes() = 1
       ON CONFLICT (strategy, side, branch_id) DO UPDATE SET
         games = games + excluded.games,
         wins = wins + excluded.wins,
         draws = draws + excluded.draws,
         score_sum = score_sum + excluded.score_sum`,
    ).bind(
      delta.strategy,
      delta.side,
      delta.branchId,
      delta.games,
      delta.wins,
      delta.draws,
      delta.scoreSum,
    ),
  );

  // D1 batch executes sequentially as one transaction. `changes()` carries the
  // receipt insert result through the aggregate statements: a duplicate event
  // keeps it at zero, so every aggregate statement becomes a no-op.
  const results = await env.DB.batch([
    receiptStatement,
    ...aggregateStatements,
  ]);
  if (results.some((result) => !result.success)) {
    throw new Error("event_transaction_failed");
  }

  const duplicate = (results[0]?.meta?.changes ?? 0) === 0;
  if (duplicate) {
    return jsonResponse(
      {
        schemaVersion: SHARED_LEARNING_SCHEMA_VERSION,
        accepted: true,
        duplicate: true,
      },
      200,
      origin,
      { "Cache-Control": "no-store" },
    );
  }

  return jsonResponse(
    {
      schemaVersion: SHARED_LEARNING_SCHEMA_VERSION,
      accepted: true,
      duplicate: false,
    },
    202,
    origin,
    { "Cache-Control": "no-store" },
  );
}

async function getLearningAggregate(
  env: Env,
  origin: string | null,
): Promise<Response> {
  const minimumGames = configuredMinimumGames(env);
  const result = await env.DB.prepare(
    `SELECT strategy, side, branch_id, games, wins, draws, score_sum
       FROM learning_aggregates
       WHERE games >= ?
       ORDER BY strategy ASC, side ASC, branch_id ASC
       LIMIT 2000`,
  )
    .bind(minimumGames)
    .all<AggregateDatabaseRow>();

  if (!result.success) {
    throw new Error("aggregate_read_failed");
  }

  const records = (result.results ?? [])
    .map(toPublicAggregateRecord)
    .filter(
      (record): record is NonNullable<typeof record> =>
        record !== null && record.games >= minimumGames,
    );

  return jsonResponse(
    {
      schemaVersion: SHARED_LEARNING_SCHEMA_VERSION,
      minimumGames,
      records,
    },
    200,
    origin,
    { "Cache-Control": "public, max-age=300" },
  );
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const originState = getAllowedOrigin(request, env);

  if (url.pathname === "/health") {
    const healthOrigin = originState === false ? null : originState;
    return jsonResponse({ ok: true }, 200, healthOrigin, {
      "Cache-Control": "no-store",
    });
  }

  if (!API_PATHS.has(url.pathname)) {
    return errorResponse(
      404,
      "not_found",
      originState === false ? null : originState,
    );
  }

  if (originState === false) {
    return errorResponse(403, "origin_not_allowed", null);
  }

  if (request.method === "OPTIONS") {
    if (originState === null) {
      return errorResponse(403, "origin_required", null);
    }
    return optionsResponse(originState);
  }

  if (url.pathname === "/v1/learning/events") {
    if (request.method !== "POST") {
      return errorResponse(405, "method_not_allowed", originState);
    }
    if (originState === null) {
      return errorResponse(403, "origin_required", null);
    }
    return receiveLearningEvent(request, env, originState);
  }

  if (request.method !== "GET") {
    return errorResponse(405, "method_not_allowed", originState);
  }
  return getLearningAggregate(env, originState);
}

export async function cleanupExpiredReceipts(env: Env): Promise<void> {
  const retentionDays = configuredReceiptRetentionDays(env);
  const result = await env.DB.prepare(
    `DELETE FROM learning_event_receipts
      WHERE received_at < unixepoch() - (? * 86400)`,
  )
    .bind(retentionDays)
    .run();

  if (!result.success) {
    throw new Error("receipt_cleanup_failed");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(
        "shared_learning_request_failed",
        error instanceof Error ? error.name : "unknown_error",
      );
      const originState = getAllowedOrigin(request, env);
      return errorResponse(
        503,
        "service_unavailable",
        originState === false ? null : originState,
      );
    }
  },
  scheduled(
    _controller: unknown,
    env: Env,
    context: WorkerExecutionContext,
  ): void {
    context.waitUntil(cleanupExpiredReceipts(env));
  },
};
