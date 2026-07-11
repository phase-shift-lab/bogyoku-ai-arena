import { describe, expect, it } from "vitest";

import { chooseBogyokuResult } from "../../src/strategy/bogyoku/decision";
import {
  defaultBogyokuProfile,
  scaledProfile,
} from "../../src/strategy/bogyoku/profile";
import { filterTacticallySafeVariations } from "../../src/strategy/bogyoku/safety";
import { rankBogyokuMoves } from "../../src/strategy/bogyoku/scoring";
import { resolveBogyokuPlan } from "../../src/strategy/bogyoku/stateMachine";
import {
  createInitialGameState,
  playUsi,
  type ShogiGameState,
} from "../../src/game/shogiGame";

function positionAfter(...moves: string[]): ShogiGameState {
  return moves.reduce(playUsi, createInitialGameState());
}

function planFor(
  game: ShogiGameState,
  evaluationCp = 0,
  rangingRookEnabled = false,
) {
  return resolveBogyokuPlan({
    enabled: true,
    sfen: game.sfen,
    evaluationCp,
    ply: game.moves.length,
    openingPlyLimit: 30,
    history: game.moves.map((move) => move.usi),
    rangingRookEnabled,
  });
}

describe("bogyoku strategy", () => {
  it("prioritizes the sente king route to the square in front of the rook", () => {
    const moves = [
      "2g2f",
      "3c3d",
      "5i4h",
      "4c4d",
      "4h3h",
      "5c5d",
      "3h2g",
      "6c6d",
    ];
    expect(planFor(positionAfter()).candidates).toEqual(["2g2f"]);
    expect(planFor(positionAfter(...moves.slice(0, 2))).candidates).toEqual([
      "5i4h",
    ]);
    expect(planFor(positionAfter(...moves.slice(0, 4))).candidates).toEqual([
      "4h3h",
    ]);
    expect(planFor(positionAfter(...moves.slice(0, 6))).candidates).toEqual([
      "3h2g",
    ]);
    expect(planFor(positionAfter(...moves))).toMatchObject({
      state: "EVALUATED_ADVANCE",
      candidates: [],
      evaluationCandidates: ["2f2e"],
    });

    const pawnAdvanced = positionAfter(...moves, "2f2e", "7c7d");
    expect(planFor(pawnAdvanced)).toMatchObject({
      state: "EVALUATED_ADVANCE",
      candidates: [],
      evaluationCandidates: ["2g2f"],
    });
  });

  it("mirrors the complete route for gote without requiring an opponent move", () => {
    const moves = [
      "7g7f",
      "8c8d",
      "6g6f",
      "5a6b",
      "5g5f",
      "6b7b",
      "4g4f",
      "7b8c",
      "3g3f",
    ];
    expect(planFor(positionAfter(...moves.slice(0, 1))).candidates).toEqual([
      "8c8d",
    ]);
    expect(planFor(positionAfter(...moves.slice(0, 3))).candidates).toEqual([
      "5a6b",
    ]);
    expect(planFor(positionAfter(...moves.slice(0, 5))).candidates).toEqual([
      "6b7b",
    ]);
    expect(planFor(positionAfter(...moves.slice(0, 7))).candidates).toEqual([
      "7b8c",
    ]);
    expect(planFor(positionAfter(...moves))).toMatchObject({
      state: "EVALUATED_ADVANCE",
      candidates: [],
      evaluationCandidates: ["8d8e"],
    });

    const pawnAdvanced = positionAfter(...moves, "8d8e", "2g2f");
    expect(planFor(pawnAdvanced)).toMatchObject({
      state: "EVALUATED_ADVANCE",
      candidates: [],
      evaluationCandidates: ["8c8d"],
    });
  });

  it("abandons forced style in check or severe disadvantage", () => {
    expect(planFor(positionAfter(), -500)).toMatchObject({
      state: "EMERGENCY_ESCAPE",
      candidates: [],
    });
  });

  it("rejects decisive losses before choosing the planned king advance", () => {
    const variations = [
      { depth: 12, multipv: 1, scoreCp: 100, pv: ["7g7f"] },
      { depth: 12, multipv: 2, scoreCp: 20, pv: ["2g2f"] },
    ];
    const safe = filterTacticallySafeVariations(variations, 110, 100);
    const ranked = rankBogyokuMoves(
      safe.accepted.map((item) => item.pv[0]!),
      0,
      defaultBogyokuProfile,
      "PREPARE",
      "sente",
      ["2g2f"],
    );
    expect(
      chooseBogyokuResult(
        { bestmove: "7g7f", variations },
        safe.accepted,
        ranked,
        ["2g2f"],
      ).bestmove,
    ).toBe("2g2f");

    const unsafe = filterTacticallySafeVariations(
      [variations[0]!, { ...variations[1]!, scoreCp: -20 }],
      110,
      100,
    );
    expect(unsafe.accepted.map((item) => item.pv[0])).toEqual(["7g7f"]);
  });

  it("allows a wider loss cap only for planned moves while still rejecting mate", () => {
    const variations = [
      { depth: 12, multipv: 1, scoreCp: 100, pv: ["7g7f"] },
      { depth: 12, multipv: 2, scoreCp: -200, pv: ["2g2f"] },
      { depth: 12, multipv: 3, scoreCp: -200, pv: ["6g6f"] },
      { depth: 12, multipv: 4, mate: -3, pv: ["2g2f"] },
    ];
    const safe = filterTacticallySafeVariations(variations, 110, 100, {
      plannedMoves: ["2g2f"],
      plannedMoveLossLimitCp: 350,
    });

    expect(safe.accepted.map((item) => item.pv[0])).toEqual(["7g7f", "2g2f"]);
    expect(safe.rejected.map((item) => item.reason)).toEqual([
      "最善手比 300cp 損",
      "被詰みを検出",
    ]);
  });

  it("offers a low-frequency ranging-rook branch after completing either route", () => {
    const senteCompleted = positionAfter(
      "2g2f",
      "3c3d",
      "5i4h",
      "4c4d",
      "4h3h",
      "5c5d",
      "3h2g",
      "6c6d",
    );
    expect(planFor(senteCompleted, 0, true)).toMatchObject({
      state: "RANGING_ROOK",
      candidates: ["2h6h", "2h7h"],
    });
    expect(
      planFor(
        positionAfter(
          ...senteCompleted.moves.map((move) => move.usi),
          "2h6h",
          "7c7d",
        ),
        0,
        true,
      ),
    ).toMatchObject({
      state: "EVALUATED_ADVANCE",
      candidates: [],
      evaluationCandidates: ["2f2e"],
    });

    const goteCompleted = positionAfter(
      "7g7f",
      "8c8d",
      "6g6f",
      "5a6b",
      "5g5f",
      "6b7b",
      "4g4f",
      "7b8c",
      "3g3f",
    );
    expect(planFor(goteCompleted, 0, true)).toMatchObject({
      state: "RANGING_ROOK",
      candidates: ["8b4b", "8b3b"],
    });
    expect(
      planFor(
        positionAfter(
          ...goteCompleted.moves.map((move) => move.usi),
          "8b4b",
          "8g8f",
        ),
        0,
        true,
      ),
    ).toMatchObject({
      state: "EVALUATED_ADVANCE",
      candidates: [],
      evaluationCandidates: ["8d8e"],
    });
  });

  it("scales style intensity and scores the corrected king route", () => {
    const gentle = scaledProfile(defaultBogyokuProfile, 25);
    const strong = scaledProfile(defaultBogyokuProfile, 100);
    expect(strong.weights.kingAdvance).toBeGreaterThan(
      gentle.weights.kingAdvance,
    );
    expect(strong.plannedMoveLossLimitCp).toBeGreaterThan(
      gentle.plannedMoveLossLimitCp,
    );
    const [ranked] = rankBogyokuMoves(
      ["5i4h"],
      4,
      strong,
      "KING_ASCENT",
      "sente",
      ["5i4h"],
    );
    expect(ranked?.breakdown.kingAdvance).toBe(1);
    expect(ranked?.score).toBeGreaterThan(0);
  });
});
