import type { PrincipalVariation } from "../../engine/usiTypes";

export interface SafetyDecision {
  readonly accepted: readonly PrincipalVariation[];
  readonly rejected: readonly {
    variation: PrincipalVariation;
    reason: string;
  }[];
}

export interface SafetyOptions {
  readonly plannedMoves?: readonly string[];
  readonly plannedMoveLossLimitCp?: number;
}

export function filterTacticallySafeVariations(
  variations: readonly PrincipalVariation[],
  tacticalLossLimitCp: number,
  referenceCp?: number,
  options: SafetyOptions = {},
): SafetyDecision {
  const baselineCp =
    referenceCp ??
    variations.find((variation) => variation.scoreCp !== undefined)?.scoreCp;
  const accepted: PrincipalVariation[] = [];
  const rejected: Array<{ variation: PrincipalVariation; reason: string }> = [];

  for (const variation of variations) {
    let reason: string | undefined;
    const firstMove = variation.pv[0];
    const lossLimitCp =
      firstMove && options.plannedMoves?.includes(firstMove)
        ? (options.plannedMoveLossLimitCp ?? tacticalLossLimitCp)
        : tacticalLossLimitCp;
    if (variation.mate !== undefined && variation.mate < 0) {
      reason = "被詰みを検出";
    } else if (
      baselineCp !== undefined &&
      variation.scoreCp !== undefined &&
      baselineCp - variation.scoreCp > lossLimitCp
    ) {
      reason = `最善手比 ${baselineCp - variation.scoreCp}cp 損`;
    } else if (!variation.pv[0]) {
      reason = "指し手なし";
    }

    if (reason) rejected.push({ variation, reason });
    else accepted.push(variation);
  }

  return { accepted, rejected };
}
