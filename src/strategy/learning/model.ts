import type { StrategyId } from "../openings/catalog";

export type LearningSide = "sente" | "gote";
export type LearningOutcome = "win" | "draw" | "loss";

export interface LearningObservation {
  readonly strategy: StrategyId;
  readonly side: LearningSide;
  readonly branchId: string;
  readonly openingEvalCp?: number;
}

export interface LearningRecord {
  readonly games: number;
  readonly wins: number;
  readonly draws: number;
  readonly scoreSum: number;
  readonly evalSum: number;
  readonly evalCount: number;
}

export interface LearningState {
  readonly version: 1;
  readonly enabled: boolean;
  readonly learnedGames: number;
  readonly records: Readonly<Record<string, LearningRecord>>;
  readonly processedOutcomeIds: readonly string[];
}

export interface LearningGameObservation extends LearningObservation {
  readonly outcome: LearningOutcome;
}

const multiplierFloor = 0.72;
const multiplierCeiling = 1.28;

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value));
}

function recordKey(
  strategy: StrategyId,
  side: LearningSide,
  branchId: string,
) {
  return `${strategy}|${side}|${branchId}`;
}

export function createInitialLearningState(): LearningState {
  return {
    version: 1,
    enabled: true,
    learnedGames: 0,
    records: {},
    processedOutcomeIds: [],
  };
}

export function setLearningEnabled(
  state: LearningState,
  enabled: boolean,
): LearningState {
  return { ...state, enabled };
}

export function recordLearningGame(
  state: LearningState,
  outcomeId: string,
  observations: readonly LearningGameObservation[],
): LearningState {
  if (!state.enabled || !outcomeId || observations.length === 0) return state;
  if (state.processedOutcomeIds.includes(outcomeId)) return state;

  const records = { ...state.records };
  for (const observation of observations) {
    const key = recordKey(
      observation.strategy,
      observation.side,
      observation.branchId,
    );
    const previous = records[key] ?? {
      games: 0,
      wins: 0,
      draws: 0,
      scoreSum: 0,
      evalSum: 0,
      evalCount: 0,
    };
    const score =
      observation.outcome === "win"
        ? 1
        : observation.outcome === "draw"
          ? 0.5
          : 0;
    const hasEval = Number.isFinite(observation.openingEvalCp);
    records[key] = {
      games: previous.games + 1,
      wins: previous.wins + (observation.outcome === "win" ? 1 : 0),
      draws: previous.draws + (observation.outcome === "draw" ? 1 : 0),
      scoreSum: previous.scoreSum + score,
      evalSum:
        previous.evalSum + (hasEval ? (observation.openingEvalCp ?? 0) : 0),
      evalCount: previous.evalCount + (hasEval ? 1 : 0),
    };
  }

  return {
    ...state,
    learnedGames: state.learnedGames + 1,
    records,
    processedOutcomeIds: [
      ...state.processedOutcomeIds,
      outcomeId,
    ].slice(-256),
  };
}

function multiplierForRecords(records: readonly LearningRecord[]) {
  const totals = records.reduce(
    (sum, record) => ({
      games: sum.games + record.games,
      score: sum.score + record.scoreSum,
      evalSum: sum.evalSum + record.evalSum,
      evalCount: sum.evalCount + record.evalCount,
    }),
    { games: 0, score: 0, evalSum: 0, evalCount: 0 },
  );
  if (totals.games === 0) return 1;
  const smoothedScore = (totals.score + 2) / (totals.games + 4);
  const evalBonus =
    totals.evalCount > 0
      ? clamp(totals.evalSum / totals.evalCount / 1200, -0.04, 0.04)
      : 0;
  return clamp(
    1 + (smoothedScore - 0.5) * 0.6 + evalBonus,
    multiplierFloor,
    multiplierCeiling,
  );
}

export function learningBranchMultiplier(
  state: LearningState,
  strategy: StrategyId,
  side: LearningSide,
  branchId: string,
) {
  if (!state.enabled) return 1;
  const record = state.records[recordKey(strategy, side, branchId)];
  return record ? multiplierForRecords([record]) : 1;
}

export function learningStrategyMultiplier(
  state: LearningState,
  strategy: StrategyId,
  side: LearningSide,
) {
  if (!state.enabled) return 1;
  const prefix = `${strategy}|${side}|`;
  const records = Object.entries(state.records)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, record]) => record);
  return multiplierForRecords(records);
}

export function parseLearningState(raw: string): LearningState | undefined {
  try {
    const value = JSON.parse(raw) as Partial<LearningState>;
    if (value.version !== 1 || typeof value.enabled !== "boolean") return;
    if (!value.records || typeof value.records !== "object") return;
    const records: Record<string, LearningRecord> = {};
    for (const [key, candidate] of Object.entries(value.records)) {
      const record = candidate as Partial<LearningRecord>;
      const numbers = [
        record.games,
        record.wins,
        record.draws,
        record.scoreSum,
        record.evalSum,
        record.evalCount,
      ];
      if (!numbers.every((number) => Number.isFinite(number))) continue;
      records[key] = {
        games: Math.max(0, Math.floor(record.games ?? 0)),
        wins: Math.max(0, Math.floor(record.wins ?? 0)),
        draws: Math.max(0, Math.floor(record.draws ?? 0)),
        scoreSum: Math.max(0, record.scoreSum ?? 0),
        evalSum: record.evalSum ?? 0,
        evalCount: Math.max(0, Math.floor(record.evalCount ?? 0)),
      };
    }
    return {
      version: 1,
      enabled: value.enabled,
      learnedGames: Math.max(0, Math.floor(value.learnedGames ?? 0)),
      records,
      processedOutcomeIds: Array.isArray(value.processedOutcomeIds)
        ? value.processedOutcomeIds
            .filter((id): id is string => typeof id === "string")
            .slice(-256)
        : [],
    };
  } catch {
    return;
  }
}
