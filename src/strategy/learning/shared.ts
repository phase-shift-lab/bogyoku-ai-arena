import { strategyOptions, type StrategyId } from "../openings/catalog";
import type {
  LearningGameObservation,
  LearningOutcome,
  LearningSide,
} from "./model";

export interface SharedLearningObservation {
  readonly strategy: StrategyId;
  readonly side: LearningSide;
  readonly branchId: string;
  readonly outcome: LearningOutcome;
}

export interface SharedLearningEvent {
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly observations: readonly SharedLearningObservation[];
}

export interface SharedLearningAggregateRecord {
  readonly strategy: StrategyId;
  readonly side: LearningSide;
  readonly branchId: string;
  readonly games: number;
  readonly scoreSum: number;
  readonly scoreRate: number;
}

export interface SharedLearningAggregate {
  readonly schemaVersion: 1;
  readonly minimumGames: number;
  readonly records: readonly SharedLearningAggregateRecord[];
}

const strategyIds = new Set<string>(strategyOptions.map(({ id }) => id));
const eventIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isStrategyId(value: unknown): value is StrategyId {
  return typeof value === "string" && strategyIds.has(value);
}

function isSide(value: unknown): value is LearningSide {
  return value === "sente" || value === "gote";
}

const branchIdPattern = /^[a-z0-9][a-z0-9._:-]{0,63}$/;

function validBranchId(
  strategy: StrategyId,
  branchId: unknown,
): branchId is string {
  return (
    typeof branchId === "string" &&
    branchIdPattern.test(branchId) &&
    (branchId === strategy || branchId.startsWith(`${strategy}:`))
  );
}

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value));
}

export function createSharedLearningEvent(
  observations: readonly LearningGameObservation[],
  eventId = crypto.randomUUID(),
): SharedLearningEvent | undefined {
  if (!eventIdPattern.test(eventId)) return;
  const unique = new Map<string, SharedLearningObservation>();
  for (const observation of observations) {
    if (
      !isStrategyId(observation.strategy) ||
      !isSide(observation.side) ||
      !validBranchId(observation.strategy, observation.branchId) ||
      !["win", "draw", "loss"].includes(observation.outcome)
    ) {
      continue;
    }
    const sanitized: SharedLearningObservation = {
      strategy: observation.strategy,
      side: observation.side,
      branchId: observation.branchId,
      outcome: observation.outcome,
    };
    unique.set(
      `${sanitized.strategy}|${sanitized.side}|${sanitized.branchId}`,
      sanitized,
    );
    if (unique.size === 12) break;
  }
  if (unique.size === 0) return;
  return {
    schemaVersion: 1,
    eventId,
    observations: [...unique.values()],
  };
}

export function parseSharedLearningAggregate(
  value: unknown,
): SharedLearningAggregate | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["schemaVersion", "minimumGames", "records"]) ||
    value.schemaVersion !== 1 ||
    !Number.isInteger(value.minimumGames) ||
    (value.minimumGames as number) < 1 ||
    !Array.isArray(value.records)
  ) {
    return;
  }
  const records: SharedLearningAggregateRecord[] = [];
  for (const candidate of value.records) {
    if (
      !isRecord(candidate) ||
      !hasOnlyKeys(candidate, [
        "strategy",
        "side",
        "branchId",
        "games",
        "scoreSum",
        "scoreRate",
      ]) ||
      !isStrategyId(candidate.strategy) ||
      !isSide(candidate.side) ||
      !validBranchId(candidate.strategy, candidate.branchId) ||
      !Number.isInteger(candidate.games) ||
      (candidate.games as number) < 0 ||
      typeof candidate.scoreSum !== "number" ||
      !Number.isFinite(candidate.scoreSum) ||
      candidate.scoreSum < 0 ||
      candidate.scoreSum > (candidate.games as number) ||
      typeof candidate.scoreRate !== "number" ||
      !Number.isFinite(candidate.scoreRate) ||
      candidate.scoreRate < 0 ||
      candidate.scoreRate > 1
    ) {
      return;
    }
    records.push({
      strategy: candidate.strategy,
      side: candidate.side,
      branchId: candidate.branchId,
      games: candidate.games as number,
      scoreSum: candidate.scoreSum,
      scoreRate: candidate.scoreRate,
    });
  }
  return {
    schemaVersion: 1,
    minimumGames: value.minimumGames as number,
    records,
  };
}

function multiplierForRecords(
  aggregate: SharedLearningAggregate | undefined,
  records: readonly SharedLearningAggregateRecord[],
) {
  if (!aggregate) return 1;
  const eligible = records.filter(
    ({ games }) => games >= aggregate.minimumGames,
  );
  if (eligible.length === 0) return 1;
  const totals = eligible.reduce(
    (sum, record) => ({
      games: sum.games + record.games,
      scoreSum: sum.scoreSum + record.scoreSum,
    }),
    { games: 0, scoreSum: 0 },
  );
  const smoothedScore = (totals.scoreSum + 2) / (totals.games + 4);
  return clamp(1 + (smoothedScore - 0.5) * 0.4, 0.9, 1.1);
}

export function sharedLearningBranchMultiplier(
  aggregate: SharedLearningAggregate | undefined,
  strategy: StrategyId,
  side: LearningSide,
  branchId: string,
) {
  return multiplierForRecords(
    aggregate,
    aggregate?.records.filter(
      (record) =>
        record.strategy === strategy &&
        record.side === side &&
        record.branchId === branchId,
    ) ?? [],
  );
}

export function sharedLearningStrategyMultiplier(
  aggregate: SharedLearningAggregate | undefined,
  strategy: StrategyId,
  side: LearningSide,
) {
  return multiplierForRecords(
    aggregate,
    aggregate?.records.filter(
      (record) => record.strategy === strategy && record.side === side,
    ) ?? [],
  );
}
