import { describe, expect, it } from "vitest";

import {
  createInitialLearningState,
  learningBranchMultiplier,
  learningStrategyMultiplier,
  parseLearningState,
  recordLearningGame,
  setLearningEnabled,
} from "../../src/strategy/learning/model";

describe("adaptive surprise opening learning", () => {
  it("starts enabled without learned games", () => {
    expect(createInitialLearningState()).toEqual({
      version: 1,
      enabled: true,
      learnedGames: 0,
      records: {},
      processedOutcomeIds: [],
    });
  });

  it("rewards successful branches and penalizes unsuccessful ones", () => {
    let state = createInitialLearningState();
    state = recordLearningGame(state, "game-win", [
      {
        strategy: "bogyoku",
        side: "sente",
        branchId: "rook-file",
        outcome: "win",
        openingEvalCp: 110,
      },
    ]);
    state = recordLearningGame(state, "game-loss", [
      {
        strategy: "bogyoku",
        side: "sente",
        branchId: "early-pawn",
        outcome: "loss",
        openingEvalCp: -180,
      },
    ]);

    expect(state.learnedGames).toBe(2);
    expect(
      learningBranchMultiplier(state, "bogyoku", "sente", "rook-file"),
    ).toBeGreaterThan(1);
    expect(
      learningBranchMultiplier(state, "bogyoku", "sente", "early-pawn"),
    ).toBeLessThan(1);
    expect(
      learningStrategyMultiplier(state, "bogyoku", "sente"),
    ).toBeGreaterThanOrEqual(0.72);
    expect(
      learningStrategyMultiplier(state, "bogyoku", "sente"),
    ).toBeLessThanOrEqual(1.28);
  });

  it("does not learn the same game twice", () => {
    const observation = {
      strategy: "oni-koroshi" as const,
      side: "gote" as const,
      branchId: "main",
      outcome: "draw" as const,
      openingEvalCp: 0,
    };
    const once = recordLearningGame(createInitialLearningState(), "same-game", [
      observation,
    ]);
    expect(recordLearningGame(once, "same-game", [observation])).toEqual(once);
  });

  it("stops recording while learning is disabled", () => {
    const disabled = setLearningEnabled(createInitialLearningState(), false);
    const updated = recordLearningGame(disabled, "disabled-game", [
      {
        strategy: "haya-ishida",
        side: "sente",
        branchId: "main",
        outcome: "win",
      },
    ]);
    expect(updated).toEqual(disabled);
  });

  it("parses exported data and rejects incompatible versions", () => {
    const state = recordLearningGame(
      createInitialLearningState(),
      "export-game",
      [{ strategy: "pacman", side: "gote", branchId: "main", outcome: "win" }],
    );
    expect(parseLearningState(JSON.stringify(state))).toEqual(state);
    expect(
      parseLearningState(JSON.stringify({ ...state, version: 2 })),
    ).toBeUndefined();
  });
});
