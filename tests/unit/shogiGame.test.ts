import { describe, expect, it } from "vitest";
import { makeSquareName, parseSquareName } from "shogiops/util";

import { restoreGame, serializeGame } from "../../src/game/gamePersistence";
import {
  createInitialGameState,
  exportKif,
  importKif,
  importSfen,
  playUsi,
  shogiGameReducer,
} from "../../src/game/shogiGame";

describe("shogiGame", () => {
  it("plays a legal move and rejects an illegal move", () => {
    const initial = createInitialGameState();
    const legal = playUsi(initial, "7g7f");
    const illegal = playUsi(initial, "7g7e");

    expect(legal.moves.at(-1)?.usi).toBe("7g7f");
    expect(legal.message).toBe("後手の手番");
    expect(illegal.moves).toHaveLength(0);
    expect(illegal.message).toBe("その手は指せません");
  });

  it("asks about optional promotion and applies the answer", () => {
    let state = createInitialGameState("4k4/9/4P4/9/9/9/9/9/4K4 b - 1");
    state = shogiGameReducer(state, {
      type: "square-selected",
      square: parseSquareName("5c"),
    });
    state = shogiGameReducer(state, {
      type: "square-selected",
      square: parseSquareName("5b"),
    });

    expect(state.pendingPromotion).toBeDefined();
    state = shogiGameReducer(state, {
      type: "promotion-resolved",
      promote: true,
    });
    expect(state.moves.at(-1)?.usi).toBe("5c5b+");
  });

  it("drops a captured piece from hand", () => {
    let state = createInitialGameState("4k4/9/9/9/9/9/9/9/4K4 b P 1");
    state = shogiGameReducer(state, { type: "hand-selected", role: "pawn" });
    state = shogiGameReducer(state, {
      type: "square-selected",
      square: parseSquareName("5e"),
    });

    expect(state.moves.at(-1)?.usi).toBe("P*5e");
  });

  it("keeps the selected piece after an invalid destination tap", () => {
    let state = createInitialGameState();
    state = shogiGameReducer(state, {
      type: "square-selected",
      square: parseSquareName("7g"),
    });
    const destinations = state.legalDestinations;

    state = shogiGameReducer(state, {
      type: "square-selected",
      square: parseSquareName("5e"),
    });

    expect(state.selection).toEqual({
      kind: "board",
      square: parseSquareName("7g"),
    });
    expect(state.legalDestinations).toEqual(destinations);
    expect(state.message).toBe("移動できるマスを選んでください");
  });

  it("declares repetition after the same position appears four times", () => {
    let state = createInitialGameState("4k4/4g4/9/9/9/9/9/4G4/4K4 b - 1");
    const cycle = ["5i6i", "5a6a", "6i5i", "6a5a"];
    for (let index = 0; index < 3; index += 1) {
      for (const usi of cycle) state = playUsi(state, usi);
    }

    expect(state.result).toEqual({ kind: "draw", reason: "repetition" });
  });

  it("ends the game when a player resigns", () => {
    const state = shogiGameReducer(createInitialGameState(), {
      type: "resigned",
      loser: "sente",
    });

    expect(state.result).toEqual({
      kind: "resignation",
      winner: "gote",
      loser: "sente",
    });
    expect(state.message).toBe("0手まで、先手の投了（後手の勝ち）");
    expect(playUsi(state, "7g7f")).toBe(state);
  });

  it("imports and exports SFEN and KIF", () => {
    const afterTwoMoves = playUsi(
      playUsi(createInitialGameState(), "7g7f"),
      "3c3d",
    );
    const kif = exportKif(afterTwoMoves);
    const restored = importKif(kif);
    const importedSfen = importSfen(afterTwoMoves.sfen);

    expect(kif).toContain("７六歩");
    expect(restored.moves.map((move) => move.usi)).toEqual(["7g7f", "3c3d"]);
    expect(importedSfen.sfen).toBe(afterTwoMoves.sfen);
    expect(makeSquareName(parseSquareName("7g"))).toBe("7g");
  });

  it("returns a safe initial state for invalid notation", () => {
    expect(importSfen("not-sfen").message).toBe("SFENを読み込めませんでした");
    expect(importKif("not-kif").message).toBe("KIFを読み込めませんでした");
  });

  it("keeps the current game when an invalid import is submitted", () => {
    const current = playUsi(createInitialGameState(), "7g7f");
    const afterSfen = shogiGameReducer(current, {
      type: "sfen-imported",
      sfen: "not-sfen",
    });
    const afterKif = shogiGameReducer(current, {
      type: "kif-imported",
      kif: "not-kif",
    });

    expect(afterSfen.sfen).toBe(current.sfen);
    expect(afterKif.sfen).toBe(current.sfen);
  });

  it("round-trips a versioned persistence snapshot", () => {
    const current = playUsi(playUsi(createInitialGameState(), "7g7f"), "3c3d");
    const restored = restoreGame(serializeGame(current));

    expect(restored?.sfen).toBe(current.sfen);
    expect(restored?.moves).toEqual(current.moves);
    expect(restoreGame('{"version":2}')).toBeUndefined();
    expect(restoreGame("broken")).toBeUndefined();
  });
});
