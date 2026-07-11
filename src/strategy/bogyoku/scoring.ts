import type { Color } from "shogiops/types";

import type { BogyokuFeature, BogyokuProfile } from "./profile";
import type { BogyokuState } from "./stateMachine";

export interface RankedBogyokuMove {
  readonly usi: string;
  readonly score: number;
  readonly breakdown: Readonly<Partial<Record<BogyokuFeature, number>>>;
}

function featuresFor(
  usi: string,
  ply: number,
  state: BogyokuState,
  side: Color,
  plannedMoves: readonly string[],
): Readonly<Partial<Record<BogyokuFeature, number>>> {
  const from = usi.slice(0, 2);
  const to = usi.slice(2, 4);
  const toFile = Number(to[0]);
  const planned = plannedMoves.includes(usi);
  const kingRoute =
    side === "sente"
      ? new Set(["5i4h", "4h3h", "3h2g", "2g2f"])
      : new Set(["5a6b", "6b7b", "7b8c", "8c8d"]);
  const supportRoute =
    side === "sente"
      ? new Set(["3g3f", "3i3h", "3h3g"])
      : new Set(["7c7d", "7a7b", "7b7c"]);
  const pressure = side === "sente" ? toFile <= 3 : toFile >= 7;
  const silverAdvance =
    side === "sente"
      ? from === "3i" || /[34][hgf]/.test(to)
      : from === "7a" || /[67][bcd]/.test(to);
  return {
    kingAdvance: planned && kingRoute.has(usi) ? 1 : 0,
    rightPressure: pressure ? 1 : 0,
    rookSupport: planned && supportRoute.has(usi) ? 1 : 0,
    silverAdvance: silverAdvance ? 1 : 0,
    tempo:
      ply < 16 && !usi.includes("+") && state !== "EMERGENCY_ESCAPE" ? 1 : 0,
  };
}

export function rankBogyokuMoves(
  moves: readonly string[],
  ply: number,
  profile: BogyokuProfile,
  state: BogyokuState,
  side: Color,
  plannedMoves: readonly string[] = [],
): readonly RankedBogyokuMove[] {
  return moves
    .map((usi) => {
      const breakdown = featuresFor(usi, ply, state, side, plannedMoves);
      const score = Object.entries(breakdown).reduce(
        (total, [feature, value]) =>
          total + profile.weights[feature as BogyokuFeature] * (value ?? 0),
        0,
      );
      return { usi, score, breakdown };
    })
    .sort((a, b) => b.score - a.score || a.usi.localeCompare(b.usi));
}
