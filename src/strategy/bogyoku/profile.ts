export type BogyokuFeature =
  "kingAdvance" | "rightPressure" | "rookSupport" | "silverAdvance" | "tempo";
export type BogyokuWeights = Readonly<Record<BogyokuFeature, number>>;

export interface BogyokuProfile {
  readonly id: "intensity";
  readonly openingName: string;
  readonly targetPhase: "opening";
  readonly description: string;
  readonly openingPlyLimit: number;
  readonly tacticalLossLimitCp: number;
  readonly plannedMoveLossLimitCp: number;
  readonly weights: BogyokuWeights;
}

function normalizeIntensity(intensity: number): number {
  return Math.max(0, Math.min(100, intensity)) / 100;
}

export function profileForIntensity(intensity: number): BogyokuProfile {
  const normalized = normalizeIntensity(intensity);
  return {
    id: "intensity",
    openingName: "棒玉",
    targetPhase: "opening",
    description:
      "奇襲強度に応じて玉の進出を優先し、評価上の決定的な悪化は避けます。",
    openingPlyLimit: Math.round(24 + 12 * normalized),
    tacticalLossLimitCp: Math.round(50 + 120 * normalized),
    plannedMoveLossLimitCp: Math.round(100 + 500 * normalized),
    weights: {
      kingAdvance: Math.round(60 * normalized),
      rightPressure: Math.round(48 * normalized),
      rookSupport: Math.round(36 * normalized),
      silverAdvance: Math.round(40 * normalized),
      tempo: Math.round(16 * normalized),
    },
  };
}

export function surpriseLossLimitCp(intensity: number): number {
  const normalized = normalizeIntensity(intensity);
  return normalized === 0 ? 0 : Math.round(60 + 320 * normalized);
}

export const defaultBogyokuProfile: BogyokuProfile = profileForIntensity(50);
