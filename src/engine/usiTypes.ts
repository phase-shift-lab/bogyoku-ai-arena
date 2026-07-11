import type { EngineRuntime } from "./runtimeCapabilities";

export interface EngineConfig {
  readonly runtime: EngineRuntime;
  readonly threads: number;
  readonly hashMb: number;
  readonly multiPv: number;
}

export interface SearchRequest {
  readonly sfen: string;
  readonly moves?: readonly string[];
  readonly searchMoves?: readonly string[];
  readonly moveTimeMs: number;
}

export interface PrincipalVariation {
  readonly depth: number;
  readonly multipv: number;
  readonly scoreCp?: number;
  readonly mate?: number;
  readonly nodes?: number;
  readonly pv: readonly string[];
}

export interface SearchResult {
  readonly bestmove: string;
  readonly ponder?: string;
  readonly variations: readonly PrincipalVariation[];
}

export type WorkerRequest =
  | {
      readonly type: "initialize";
      readonly id: number;
      readonly assetBaseUrl: string;
      readonly config: EngineConfig;
    }
  | {
      readonly type: "search";
      readonly id: number;
      readonly request: SearchRequest;
    }
  | { readonly type: "stop"; readonly id: number }
  | { readonly type: "dispose"; readonly id: number };

export type WorkerResponse =
  | { readonly type: "ready"; readonly id: number }
  | { readonly type: "output"; readonly line: string }
  | {
      readonly type: "result";
      readonly id: number;
      readonly result: SearchResult;
    }
  | { readonly type: "stopped"; readonly id: number }
  | { readonly type: "error"; readonly id: number; readonly message: string };
