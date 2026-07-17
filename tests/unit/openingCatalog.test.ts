import { describe, expect, it } from "vitest";

import { createInitialGameState, playUsi } from "../../src/game/shogiGame";
import {
  chooseRandomSurpriseStrategy,
  openingCandidateDetails,
  openingGuides,
  openingCandidates,
  strategyOptions,
  surpriseStrategyOptions,
} from "../../src/strategy/openings/catalog";

describe("openingCandidates", () => {
  it("offers the first legal surprise move for sente", () => {
    const game = createInitialGameState();

    expect(openingCandidates("oni-koroshi", game.sfen, [])).toEqual(["7g7f"]);
    expect(openingCandidates("haya-ishida", game.sfen, [])).toEqual(["7g7f"]);
    expect(openingCandidates("edge-bishop-nakabisha", game.sfen, [])).toEqual([
      "5g5f",
      "9g9f",
    ]);
  });

  it("mirrors the opening for gote", () => {
    const game = playUsi(createInitialGameState(), "7g7f");

    expect(openingCandidates("oni-koroshi", game.sfen, ["7g7f"])).toEqual([
      "3c3d",
    ]);
  });

  it("resumes the nearest legal setup move after that side diverges", () => {
    let game = playUsi(createInitialGameState(), "2g2f");
    game = playUsi(game, "3c3d");

    expect(
      openingCandidates("oni-koroshi", game.sfen, ["2g2f", "3c3d"]),
    ).toEqual(["7g7f"]);
  });

  it("keeps alternate move orders for branch-aware openings", () => {
    let game = playUsi(createInitialGameState(), "7g7f");
    game = playUsi(game, "3c3d");

    expect(
      openingCandidates("new-oni-koroshi", game.sfen, ["7g7f", "3c3d"]),
    ).toEqual(["8i7g", "6i5h"]);
  });

  it("offers fifteen surprise strategies plus normal play", () => {
    expect(strategyOptions).toHaveLength(16);
    expect(surpriseStrategyOptions).toHaveLength(15);
    expect(strategyOptions.map((option) => option.label)).toEqual(
      expect.arrayContaining([
        "棒玉",
        "新鬼殺し",
        "パックマン",
        "角頭歩",
        "きんとうん",
        "鎖鎌銀",
        "一間飛車",
        "通常",
      ]),
    );
  });

  it("defines a basic line and ideal formation for every guided surprise", () => {
    expect(Object.keys(openingGuides)).toHaveLength(14);
    for (const guide of Object.values(openingGuides)) {
      expect(guide.idealForm.length).toBeGreaterThan(8);
      expect(guide.lines.length).toBeGreaterThanOrEqual(3);
      expect(guide.lines.every((line) => line.length > 0)).toBe(true);
    }
  });

  it("provides weighted branch metadata for adaptive selection", () => {
    const game = createInitialGameState();
    const candidates = openingCandidateDetails("new-oni-koroshi", game.sfen, []);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.branchId.length > 0)).toBe(true);
    expect(candidates.every((candidate) => candidate.baseWeight > 0)).toBe(true);
    expect(new Set(candidates.map((candidate) => candidate.branchId)).size).toBeGreaterThan(1);
  });

  it("chooses only surprise strategies in auto mode", () => {
    expect(chooseRandomSurpriseStrategy(0, () => 0)).toBe("bogyoku");
    expect(chooseRandomSurpriseStrategy(100, () => 0.999999)).toBe(
      "primitive-climbing-silver",
    );
    expect(chooseRandomSurpriseStrategy(50, () => 0.5)).not.toBe("normal");
  });
});
