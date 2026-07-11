export type BogyokuFeature =
  "kingAdvance" | "rightPressure" | "rookSupport" | "silverAdvance" | "tempo";
export type BogyokuWeights = Readonly<Record<BogyokuFeature, number>>;

export interface BogyokuProfile {
  readonly id: "practical" | "forced" | "win-rate";
  readonly openingName: string;
  readonly targetPhase: "opening";
  readonly description: string;
  readonly openingPlyLimit: number;
  readonly tacticalLossLimitCp: number;
  readonly plannedMoveLossLimitCp: number;
  readonly weights: BogyokuWeights;
}

export const bogyokuProfiles: readonly BogyokuProfile[] = [
  {
    id: "practical",
    openingName: "棒玉・実戦型",
    targetPhase: "opening",
    description: "玉を前へ運び、飛車・銀・歩との連携と勝ちやすさを両立します。",
    openingPlyLimit: 30,
    tacticalLossLimitCp: 110,
    plannedMoveLossLimitCp: 350,
    weights: {
      kingAdvance: 30,
      rightPressure: 24,
      rookSupport: 18,
      silverAdvance: 20,
      tempo: 8,
    },
  },
  {
    id: "forced",
    openingName: "棒玉・強制型",
    targetPhase: "opening",
    description: "許容範囲内で棒玉らしい進行を強く優先する実験向け設定です。",
    openingPlyLimit: 36,
    tacticalLossLimitCp: 170,
    plannedMoveLossLimitCp: 500,
    weights: {
      kingAdvance: 42,
      rightPressure: 36,
      rookSupport: 24,
      silverAdvance: 32,
      tempo: 12,
    },
  },
  {
    id: "win-rate",
    openingName: "棒玉・勝率重視",
    targetPhase: "opening",
    description: "戦術的な安全性を優先し、危険なら通常探索へ戻します。",
    openingPlyLimit: 24,
    tacticalLossLimitCp: 70,
    plannedMoveLossLimitCp: 200,
    weights: {
      kingAdvance: 16,
      rightPressure: 16,
      rookSupport: 20,
      silverAdvance: 14,
      tempo: 6,
    },
  },
] as const;

export const defaultBogyokuProfile: BogyokuProfile = bogyokuProfiles[0]!;

export function profileById(id: BogyokuProfile["id"]): BogyokuProfile {
  return (
    bogyokuProfiles.find((profile) => profile.id === id) ??
    defaultBogyokuProfile
  );
}

export function scaledProfile(
  profile: BogyokuProfile,
  intensity: number,
): BogyokuProfile {
  const normalized = Math.max(0, Math.min(100, intensity)) / 50;
  return {
    ...profile,
    tacticalLossLimitCp: Math.round(
      profile.tacticalLossLimitCp * (0.65 + normalized * 0.35),
    ),
    plannedMoveLossLimitCp: Math.round(
      profile.plannedMoveLossLimitCp * (0.65 + normalized * 0.35),
    ),
    weights: Object.fromEntries(
      Object.entries(profile.weights).map(([feature, weight]) => [
        feature,
        Math.round(weight * normalized),
      ]),
    ) as BogyokuWeights,
  };
}
