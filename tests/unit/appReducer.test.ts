import { describe, expect, it } from "vitest";

import { appReducer, initialAppState } from "../../src/app/appReducer";

describe("appReducer", () => {
  it("selects a game mode and resets the game state", () => {
    const result = appReducer(
      { ...initialAppState, status: "paused", ply: 24 },
      { type: "mode-selected", mode: "analysis" },
    );

    expect(result).toEqual({ mode: "analysis", status: "ready", ply: 0 });
  });

  it("starts and resets a game", () => {
    const started = appReducer(initialAppState, { type: "game-started" });
    const reset = appReducer(started, { type: "game-reset" });

    expect(started.status).toBe("playing");
    expect(reset).toEqual(initialAppState);
  });
});
