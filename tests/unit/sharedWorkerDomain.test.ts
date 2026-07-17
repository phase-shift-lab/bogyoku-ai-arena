import { describe, expect, it } from "vitest";

import {
  parseLearningEventRequest,
  toPublicAggregateRecord,
} from "../../worker/src/domain";

const baseRequest = {
  schemaVersion: 1,
  eventId: "550e8400-e29b-41d4-a716-446655440000",
  observations: [
    {
      strategy: "oni-koroshi",
      side: "gote",
      branchId: "oni-koroshi:main",
      outcome: "draw",
    },
  ],
};

describe("shared learning Worker contract", () => {
  it.each(["kif", "sfen", "moves", "evaluation", "deviceId"])(
    "rejects the forbidden top-level field %s",
    (field) => {
      const request = { ...baseRequest, [field]: "must-not-leave-the-device" };
      expect(parseLearningEventRequest(request).ok).toBe(false);
    },
  );

  it("uses sente/gote and rejects black/white labels", () => {
    expect(parseLearningEventRequest(baseRequest).ok).toBe(true);

    const observations = [{ ...baseRequest.observations[0], side: "white" }];
    expect(parseLearningEventRequest({ ...baseRequest, observations }).ok).toBe(
      false,
    );
  });

  it("maps only a consistent aggregate row to the public contract", () => {
    expect(
      toPublicAggregateRecord({
        strategy: "oni-koroshi",
        side: "gote",
        branch_id: "oni-koroshi:main",
        games: 30,
        wins: 12,
        draws: 6,
        score_sum: 15,
      }),
    ).toEqual({
      strategy: "oni-koroshi",
      side: "gote",
      branchId: "oni-koroshi:main",
      games: 30,
      wins: 12,
      draws: 6,
      scoreSum: 15,
    });
  });

  it("rejects a row whose score sum disagrees with wins and draws", () => {
    expect(
      toPublicAggregateRecord({
        strategy: "oni-koroshi",
        side: "gote",
        branch_id: "oni-koroshi:main",
        games: 30,
        wins: 12,
        draws: 6,
        score_sum: 14.5,
      }),
    ).toBeNull();
  });
});
