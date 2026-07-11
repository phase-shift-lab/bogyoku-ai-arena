import type { AppState, GameMode } from "../game/gameTypes";

export const initialAppState: AppState = {
  mode: "human-vs-ai",
  status: "ready",
  ply: 0,
};

export type AppAction =
  | { readonly type: "mode-selected"; readonly mode: GameMode }
  | { readonly type: "game-started" }
  | { readonly type: "game-paused" }
  | { readonly type: "engine-thinking" }
  | { readonly type: "engine-ready" }
  | { readonly type: "game-finished" }
  | { readonly type: "engine-error" }
  | { readonly type: "game-reset" };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "mode-selected":
      return { ...state, mode: action.mode, status: "ready", ply: 0 };
    case "game-started":
      return { ...state, status: "playing" };
    case "game-paused":
      return { ...state, status: "paused" };
    case "engine-thinking":
      return { ...state, status: "thinking" };
    case "engine-ready":
      return { ...state, status: "playing" };
    case "game-finished":
      return { ...state, status: "finished" };
    case "engine-error":
      return { ...state, status: "error" };
    case "game-reset":
      return initialAppState;
  }
}
