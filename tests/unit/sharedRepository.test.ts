import { describe, expect, it, vi } from "vitest";

import type { SharedLearningEvent } from "../../src/strategy/learning/shared";
import { createSharedLearningRepository } from "../../src/strategy/learning/sharedRepository";

const event: SharedLearningEvent = {
  schemaVersion: 1,
  eventId: "123e4567-e89b-42d3-a456-426614174000",
  observations: [
    {
      strategy: "bogyoku",
      side: "sente",
      branchId: "bogyoku:line-1",
      outcome: "win",
    },
  ],
};

function responseFetcher(response: Response) {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

describe("shared learning repository", () => {
  it("uses a no-network fallback when the API is not configured", async () => {
    const fetcher = responseFetcher(new Response());
    const repository = createSharedLearningRepository("  ", fetcher);

    expect(repository.configured).toBe(false);
    await expect(repository.loadAggregate()).resolves.toBeUndefined();
    await expect(repository.submitEvent(event)).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads a valid anonymous aggregate without credentials", async () => {
    const fetcher = responseFetcher(
      Response.json({ schemaVersion: 1, minimumGames: 30, records: [] }),
    );
    const repository = createSharedLearningRepository(
      "https://learning.example/",
      fetcher,
    );

    await expect(repository.loadAggregate()).resolves.toEqual({
      schemaVersion: 1,
      minimumGames: 30,
      records: [],
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://learning.example/v1/learning/aggregate",
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        cache: "no-store",
      }),
    );
  });

  it("submits only the sanitized DTO", async () => {
    const fetcher = responseFetcher(
      Response.json({ schemaVersion: 1, accepted: true, duplicate: false }),
    );
    const repository = createSharedLearningRepository(
      "https://learning.example",
      fetcher,
    );

    await expect(repository.submitEvent(event)).resolves.toBe(true);
    const init = vi.mocked(fetcher).mock.calls[0]?.[1];
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: JSON.stringify(event),
      }),
    );
    expect(String(init?.body)).not.toMatch(
      /sfen|moves|openingEvalCp|device|outcomeId/i,
    );
  });

  it("treats HTTP and response-contract failures as unavailable", async () => {
    const httpFailure = createSharedLearningRepository(
      "https://learning.example",
      responseFetcher(new Response(null, { status: 503 })),
    );
    const invalidResponse = createSharedLearningRepository(
      "https://learning.example",
      responseFetcher(Response.json({ accepted: true })),
    );

    await expect(httpFailure.loadAggregate()).resolves.toBeUndefined();
    await expect(httpFailure.submitEvent(event)).resolves.toBe(false);
    await expect(invalidResponse.submitEvent(event)).resolves.toBe(false);
  });
});
