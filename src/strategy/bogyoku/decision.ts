import type { PrincipalVariation, SearchResult } from "../../engine/usiTypes";
import type { RankedBogyokuMove } from "./scoring";

export function chooseBogyokuResult(
  result: SearchResult,
  safeVariations: readonly PrincipalVariation[],
  ranked: readonly RankedBogyokuMove[],
  plannedMoves: readonly string[],
): SearchResult {
  const safeMoves = new Set(
    safeVariations.flatMap((variation) =>
      variation.pv[0] ? [variation.pv[0]] : [],
    ),
  );
  const selected =
    plannedMoves.find((move) => safeMoves.has(move)) ??
    ranked.find((move) => safeMoves.has(move.usi))?.usi ??
    result.bestmove;

  return selected === result.bestmove
    ? result
    : { bestmove: selected, variations: result.variations };
}
