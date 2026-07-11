import { describe, expect, it } from "vitest";
import { parseSfen } from "shogiops/sfen";
import { parseSquareName } from "shogiops/util";

import {
  positionPresetById,
  positionPresets,
} from "../../src/game/positionPresets";

describe("positionPresets", () => {
  it("contains parseable standard positions", () => {
    for (const preset of positionPresets) {
      expect(() =>
        parseSfen("standard", preset.sfen, true).unwrap(),
      ).not.toThrow();
    }
  });

  it("removes the advertised gote pieces", () => {
    const twoPiece = parseSfen(
      "standard",
      positionPresetById("two-piece").sfen,
      true,
    ).unwrap();
    const fourPiece = parseSfen(
      "standard",
      positionPresetById("four-piece").sfen,
      true,
    ).unwrap();

    expect(twoPiece.board.get(parseSquareName("8b"))).toBeUndefined();
    expect(twoPiece.board.get(parseSquareName("2b"))).toBeUndefined();
    expect(fourPiece.board.get(parseSquareName("9a"))).toBeUndefined();
    expect(fourPiece.board.get(parseSquareName("1a"))).toBeUndefined();
    expect(fourPiece.board.get(parseSquareName("8b"))).toBeUndefined();
    expect(fourPiece.board.get(parseSquareName("2b"))).toBeUndefined();
  });
});
