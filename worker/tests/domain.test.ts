import { describe, expect, it } from "vitest";

import {
  MAX_OBSERVATIONS_PER_EVENT,
  collapseObservations,
  parseLearningEventRequest,
  toPublicAggregateRecord,
} from "../src/domain";

const validRequest = {
  schemaVersion: 1,
  eventId: "550E8400-E29B-41D4-A716-446655440000",
  observations: [
    {
      strategy: "bogyoku",
      side: "sente",
      branchId: "bogyoku:king-forward",
      outcome: "win",
    },
  ],
};

describe("parseLearningEventRequest", () => {
  it("accepts a strict anonymous event and normalizes the UUID", () => {
    const result = parseLearningEventRequest(validRequest);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.value.observations[0]?.side).toBe("sente");
    }
  });

  it("rejects unknown top-level fields such as SFEN", () => {
    expect(
      parseLearningEventRequest({ ...validRequest, sfen: "forbidden" }).ok,
    ).toBe(false);
  });

  it("rejects unknown observation fields such as a move", () => {
    const observations = [{ ...validRequest.observations[0], move: "7g7f" }];
    expect(
      parseLearningEventRequest({ ...validRequest, observations }).ok,
    ).toBe(false);
  });

  it("rejects legacy side labels", () => {
    const observations = [{ ...validRequest.observations[0], side: "black" }];
    expect(
      parseLearningEventRequest({ ...validRequest, observations }).ok,
    ).toBe(false);
  });

  it("rejects branch IDs outside their strategy namespace", () => {
    const observations = [
      { ...validRequest.observations[0], branchId: "normal:main" },
    ];
    expect(
      parseLearningEventRequest({ ...validRequest, observations }).ok,
    ).toBe(false);
  });

  it("rejects more than the per-event observation limit", () => {
    const observations = Array.from(
      { length: MAX_OBSERVATIONS_PER_EVENT + 1 },
      (_, index) => ({
        ...validRequest.observations[0],
        branchId: `bogyoku:branch-${index}`,
      }),
    );
    expect(
      parseLearningEventRequest({ ...validRequest, observations }).ok,
    ).toBe(false);
  });

  it("rejects conflicting duplicates", () => {
    const observations = [
      validRequest.observations[0],
      { ...validRequest.observations[0], outcome: "loss" },
    ];
    expect(
      parseLearningEventRequest({ ...validRequest, observations }).ok,
    ).toBe(false);
  });
});

describe("collapseObservations", () => {
  it("counts an identical duplicate only once", () => {
    const parsed = parseLearningEventRequest({
      ...validRequest,
      observations: [
        validRequest.observations[0],
        validRequest.observations[0],
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(collapseObservations(parsed.value.observations)).toEqual([
      {
        strategy: "bogyoku",
        side: "sente",
        branchId: "bogyoku:king-forward",
        games: 1,
        wins: 1,
        draws: 0,
        scoreSum: 1,
      },
    ]);
  });
});

describe("toPublicAggregateRecord", () => {
  it("rejects inconsistent database rows", () => {
    expect(
      toPublicAggregateRecord({
        strategy: "bogyoku",
        side: "gote",
        branch_id: "bogyoku:king-forward",
        games: 1,
        wins: 2,
        draws: 0,
        score_sum: 2,
      }),
    ).toBeNull();
  });

  it("rejects a score sum that does not equal wins plus half the draws", () => {
    expect(
      toPublicAggregateRecord({
        strategy: "bogyoku",
        side: "gote",
        branch_id: "bogyoku:king-forward",
        games: 30,
        wins: 12,
        draws: 6,
        score_sum: 14.5,
      }),
    ).toBeNull();
  });
});
