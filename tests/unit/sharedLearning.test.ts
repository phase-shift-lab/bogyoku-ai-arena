import { describe, expect, it } from "vitest";

import type { LearningGameObservation } from "../../src/strategy/learning/model";
import {
  createSharedLearningEvent,
  parseSharedLearningAggregate,
  sharedLearningBranchMultiplier,
  sharedLearningStrategyMultiplier,
} from "../../src/strategy/learning/shared";

const eventId = "123e4567-e89b-42d3-a456-426614174000";

describe("anonymous shared learning data", () => {
  it("removes local-only evaluation data from submitted observations", () => {
    const event = createSharedLearningEvent(
      [
        {
          strategy: "bogyoku",
          side: "sente",
          branchId: "bogyoku:line-1",
          outcome: "win",
          openingEvalCp: 480,
        },
      ],
      eventId,
    );

    expect(event).toEqual({
      schemaVersion: 1,
      eventId,
      observations: [
        {
          strategy: "bogyoku",
          side: "sente",
          branchId: "bogyoku:line-1",
          outcome: "win",
        },
      ],
    });
    expect(JSON.stringify(event)).not.toContain("openingEvalCp");
  });

  it("deduplicates branches, rejects invalid identifiers, and caps one event", () => {
    const observations: LearningGameObservation[] = Array.from(
      { length: 14 },
      (_, index) => ({
        strategy: "bogyoku",
        side: "gote",
        branchId: `bogyoku:line-${index + 1}`,
        outcome: "draw",
      }),
    );
    observations.unshift({
      strategy: "bogyoku",
      side: "gote",
      branchId: "not-owned-by-bogyoku",
      outcome: "win",
    });
    observations.push(observations[1]!);

    const event = createSharedLearningEvent(observations, eventId);

    expect(event?.observations).toHaveLength(12);
    expect(
      event?.observations.every(({ branchId }) =>
        branchId.startsWith("bogyoku:"),
      ),
    ).toBe(true);
  });

  it("strictly parses aggregate responses", () => {
    const aggregate = {
      schemaVersion: 1,
      minimumGames: 30,
      records: [
        {
          strategy: "oni-koroshi",
          side: "sente",
          branchId: "oni-koroshi:main",
          games: 40,
          scoreSum: 24,
          scoreRate: 0.6,
        },
      ],
    };

    expect(parseSharedLearningAggregate(aggregate)).toEqual(aggregate);
    expect(
      parseSharedLearningAggregate({ ...aggregate, deviceId: "forbidden" }),
    ).toBeUndefined();
    expect(
      parseSharedLearningAggregate({
        ...aggregate,
        records: [{ ...aggregate.records[0], moves: ["7g7f"] }],
      }),
    ).toBeUndefined();
  });

  it("ignores small samples and bounds shared influence", () => {
    const aggregate = parseSharedLearningAggregate({
      schemaVersion: 1,
      minimumGames: 30,
      records: [
        {
          strategy: "bogyoku",
          side: "sente",
          branchId: "bogyoku:strong",
          games: 100,
          scoreSum: 100,
          scoreRate: 1,
        },
        {
          strategy: "bogyoku",
          side: "sente",
          branchId: "bogyoku:small",
          games: 29,
          scoreSum: 29,
          scoreRate: 1,
        },
      ],
    });

    expect(
      sharedLearningBranchMultiplier(
        aggregate,
        "bogyoku",
        "sente",
        "bogyoku:small",
      ),
    ).toBe(1);
    expect(
      sharedLearningBranchMultiplier(
        aggregate,
        "bogyoku",
        "sente",
        "bogyoku:strong",
      ),
    ).toBe(1.1);
    expect(
      sharedLearningStrategyMultiplier(aggregate, "bogyoku", "sente"),
    ).toBeLessThanOrEqual(1.1);
  });
});
