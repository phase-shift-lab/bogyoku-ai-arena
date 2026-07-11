export type GameMode = "human-vs-ai" | "ai-vs-ai" | "analysis";

export type GameStatus =
  "idle" | "ready" | "playing" | "thinking" | "paused" | "finished" | "error";

export interface AppState {
  readonly mode: GameMode;
  readonly status: GameStatus;
  readonly ply: number;
}
