import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShogiBoard } from "../../src/components/ShogiBoard";
import { createInitialGameState, playUsi } from "../../src/game/shogiGame";

function renderBoard(flipped = false) {
  const state = playUsi(createInitialGameState(), "7g7f");
  document.body.innerHTML = renderToStaticMarkup(
    createElement(ShogiBoard, {
      state,
      dispatch: () => undefined,
      enabled: true,
      flipped,
    }),
  );
}

describe("ShogiBoard", () => {
  it.each([false, true])(
    "直前手の移動元と移動先を盤反転状態 %s でも強調する",
    (flipped) => {
      renderBoard(flipped);

      expect(
        document
          .querySelector('[data-square="7g"]')
          ?.getAttribute("data-last-origin"),
      ).toBe("true");
      expect(
        document
          .querySelector('[data-square="7f"]')
          ?.getAttribute("data-last-destination"),
      ).toBe("true");
      expect(document.querySelector(".last-move-label")?.textContent).toBe(
        "直前手：▲７六歩",
      );
    },
  );
});
