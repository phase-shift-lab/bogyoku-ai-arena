import { describe, expect, it } from "vitest";

import { createInitialGameState, playUsi } from "../../src/game/shogiGame";
import { openingCandidates } from "../../src/strategy/openings/catalog";

describe("openingCandidates", () => {
  it("offers the first legal surprise move for sente", () => {
    const game = createInitialGameState();

    expect(openingCandidates("oni-koroshi", game.sfen, [])).toEqual(["7g7f"]);
    expect(openingCandidates("haya-ishida", game.sfen, [])).toEqual(["7g7f"]);
    expect(openingCandidates("edge-bishop-nakabisha", game.sfen, [])).toEqual([
      "9g9f",
    ]);
  });

  it("mirrors the opening for gote", () => {
    const game = playUsi(createInitialGameState(), "7g7f");

    expect(openingCandidates("oni-koroshi", game.sfen, ["7g7f"])).toEqual([
      "3c3d",
    ]);
  });

  it("stops forcing an opening after that side diverges", () => {
    let game = playUsi(createInitialGameState(), "2g2f");
    game = playUsi(game, "3c3d");

    expect(
      openingCandidates("oni-koroshi", game.sfen, ["2g2f", "3c3d"]),
    ).toEqual([]);
  });
});
