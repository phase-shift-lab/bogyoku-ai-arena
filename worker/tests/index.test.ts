import { describe, expect, it, vi } from "vitest";

import worker, { cleanupExpiredReceipts, type Env } from "../src/index";
import { MAX_REQUEST_BODY_BYTES } from "../src/domain";

const allowedOrigin = "https://phase-shift-lab.github.io";

function unusedDatabase(): Env["DB"] {
  return {} as Env["DB"];
}

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: unusedDatabase(),
    ALLOWED_ORIGINS: allowedOrigin,
    ...overrides,
  };
}

async function responseBody(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("learning event request boundary", () => {
  it("rejects a POST without an Origin header", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/v1/learning/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      baseEnv(),
    );

    expect(response.status).toBe(403);
    expect(await responseBody(response)).toMatchObject({
      schemaVersion: 1,
      error: "origin_required",
    });
  });

  it("enforces the 8 KiB limit while consuming a stream", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_REQUEST_BODY_BYTES + 1));
        controller.close();
      },
    });
    const request = new Request("https://worker.example/v1/learning/events", {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        "Content-Type": "application/json",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    expect(request.headers.has("Content-Length")).toBe(false);
    const response = await worker.fetch(request, baseEnv());

    expect(response.status).toBe(413);
    expect(await responseBody(response)).toMatchObject({
      error: "payload_too_large",
    });
  });

  it("fails closed when production requires a missing limiter", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/v1/learning/events", {
        method: "POST",
        headers: {
          Origin: allowedOrigin,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      baseEnv({ REQUIRE_RATE_LIMITER: "true" }),
    );

    expect(response.status).toBe(503);
    expect(await responseBody(response)).toMatchObject({
      error: "rate_limit_unavailable",
    });
  });

  it("returns 429 and gives the limiter only a hashed client key", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const rawIp = "203.0.113.9";
    const response = await worker.fetch(
      new Request("https://worker.example/v1/learning/events", {
        method: "POST",
        headers: {
          Origin: allowedOrigin,
          "CF-Connecting-IP": rawIp,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      baseEnv({
        REQUIRE_RATE_LIMITER: "true",
        LEARNING_EVENT_RATE_LIMITER: { limit },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(limit).toHaveBeenCalledOnce();
    const key = limit.mock.calls[0]?.[0]?.key as string;
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(rawIp);
  });
});

describe("receipt retention", () => {
  it("cleans receipts using the 30-day default", async () => {
    const statement = {
      bind: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn(),
    };
    statement.bind.mockReturnValue(statement);
    const prepare = vi.fn().mockReturnValue(statement);
    const db = { prepare, batch: vi.fn() } as unknown as Env["DB"];

    await cleanupExpiredReceipts({ DB: db });

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM learning_event_receipts"),
    );
    expect(statement.bind).toHaveBeenCalledWith(30);
    expect(statement.run).toHaveBeenCalledOnce();
  });
});
