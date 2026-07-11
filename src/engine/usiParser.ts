import type { PrincipalVariation } from "./usiTypes";

function numberAfter(tokens: readonly string[], key: string) {
  const index = tokens.indexOf(key);
  if (index < 0) return undefined;
  const value = Number(tokens[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

export function parseInfoLine(line: string): PrincipalVariation | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info") return undefined;
  const pvIndex = tokens.indexOf("pv");
  if (pvIndex < 0 || pvIndex === tokens.length - 1) return undefined;
  const scoreIndex = tokens.indexOf("score");
  const scoreType = scoreIndex >= 0 ? tokens[scoreIndex + 1] : undefined;
  const score = scoreIndex >= 0 ? Number(tokens[scoreIndex + 2]) : undefined;
  return {
    depth: numberAfter(tokens, "depth") ?? 0,
    multipv: numberAfter(tokens, "multipv") ?? 1,
    scoreCp: scoreType === "cp" && Number.isFinite(score) ? score : undefined,
    mate: scoreType === "mate" && Number.isFinite(score) ? score : undefined,
    nodes: numberAfter(tokens, "nodes"),
    pv: tokens.slice(pvIndex + 1),
  };
}

export function parseBestmove(line: string) {
  const match = /^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/.exec(line.trim());
  if (!match?.[1]) return undefined;
  return { bestmove: match[1], ponder: match[2] };
}
