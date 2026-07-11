import { describe, expect, it } from "vitest";

import { classifyMoveAudio } from "../../src/audio/gameAudio";
import { createInitialGameState, playUsi } from "../../src/game/shogiGame";

describe("game audio classification", () => {
  it("distinguishes a normal move from a capture", () => {
    const initial = createInitialGameState();
    const moved = playUsi(initial, "7g7f");
    expect(classifyMoveAudio(initial.sfen, moved.sfen, "7g7f")).toMatchObject({
      capture: false,
      promotion: false,
    });

    const beforeCapture = [
      "7g7f",
      "3c3d",
      "7f7e",
      "3d3e",
      "7e7d",
      "3e3f",
    ].reduce(playUsi, initial);
    const captured = playUsi(beforeCapture, "7d7c+");
    expect(
      classifyMoveAudio(beforeCapture.sfen, captured.sfen, "7d7c+"),
    ).toMatchObject({ capture: true, promotion: true });
  });
});
