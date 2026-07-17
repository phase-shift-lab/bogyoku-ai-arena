export const SHARED_LEARNING_SCHEMA_VERSION = 1 as const;
export const MAX_REQUEST_BODY_BYTES = 8 * 1024;
export const MAX_OBSERVATIONS_PER_EVENT = 12;
export const MIN_PUBLIC_AGGREGATE_GAMES = 30;

export const STRATEGY_IDS = [
  "bogyoku",
  "oni-koroshi",
  "new-oni-koroshi",
  "haya-ishida",
  "suji-chigai-kaku",
  "pacman",
  "ureshino",
  "edge-bishop-nakabisha",
  "bishop-head-pawn",
  "kintoun",
  "ponpon-kei",
  "duck",
  "kusarigama-silver",
  "first-file-rook",
  "primitive-climbing-silver",
  "normal",
] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];
export type LearningSide = "sente" | "gote";
export type LearningOutcome = "win" | "draw" | "loss";

export interface LearningObservation {
  strategy: StrategyId;
  side: LearningSide;
  branchId: string;
  outcome: LearningOutcome;
}

export interface LearningEventRequest {
  schemaVersion: typeof SHARED_LEARNING_SCHEMA_VERSION;
  eventId: string;
  observations: LearningObservation[];
}

export interface AggregateDelta {
  strategy: StrategyId;
  side: LearningSide;
  branchId: string;
  games: number;
  wins: number;
  draws: number;
  scoreSum: number;
}

export interface AggregateDatabaseRow {
  strategy: string;
  side: string;
  branch_id: string;
  games: number;
  wins: number;
  draws: number;
  score_sum: number;
}

export interface PublicAggregateRecord {
  strategy: StrategyId;
  side: LearningSide;
  branchId: string;
  games: number;
  wins: number;
  draws: number;
  scoreSum: number;
}

export type ParseLearningEventResult =
  | { ok: true; value: LearningEventRequest }
  | { ok: false; code: "invalid_payload"; message: string };

const STRATEGY_SET: ReadonlySet<string> = new Set(STRATEGY_IDS);
const SIDE_SET: ReadonlySet<string> = new Set(["sente", "gote"]);
const OUTCOME_SET: ReadonlySet<string> = new Set(["win", "draw", "loss"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(record);
  return (
    actual.length === expected.length &&
    expected.every((key) => Object.hasOwn(record, key))
  );
}

function isStrategyId(value: unknown): value is StrategyId {
  return typeof value === "string" && STRATEGY_SET.has(value);
}

function isLearningSide(value: unknown): value is LearningSide {
  return typeof value === "string" && SIDE_SET.has(value);
}

function isLearningOutcome(value: unknown): value is LearningOutcome {
  return typeof value === "string" && OUTCOME_SET.has(value);
}

export function isValidBranchId(
  strategy: StrategyId,
  branchId: unknown,
): branchId is string {
  return (
    typeof branchId === "string" &&
    BRANCH_ID_PATTERN.test(branchId) &&
    (branchId === strategy || branchId.startsWith(`${strategy}:`))
  );
}

export function parseLearningEventRequest(
  value: unknown,
): ParseLearningEventResult {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "eventId", "observations"])
  ) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "Request fields are invalid.",
    };
  }

  if (value.schemaVersion !== SHARED_LEARNING_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "Unsupported schema version.",
    };
  }

  if (typeof value.eventId !== "string" || !UUID_PATTERN.test(value.eventId)) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "eventId must be a canonical UUID.",
    };
  }

  if (
    !Array.isArray(value.observations) ||
    value.observations.length === 0 ||
    value.observations.length > MAX_OBSERVATIONS_PER_EVENT
  ) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "observations must contain 1 to 12 items.",
    };
  }

  const observations: LearningObservation[] = [];
  const outcomesByKey = new Map<string, LearningOutcome>();

  for (const candidate of value.observations) {
    if (
      !isPlainRecord(candidate) ||
      !hasExactKeys(candidate, ["strategy", "side", "branchId", "outcome"])
    ) {
      return {
        ok: false,
        code: "invalid_payload",
        message: "Observation fields are invalid.",
      };
    }

    if (!isStrategyId(candidate.strategy)) {
      return {
        ok: false,
        code: "invalid_payload",
        message: "Unknown strategy.",
      };
    }
    if (!isLearningSide(candidate.side)) {
      return { ok: false, code: "invalid_payload", message: "Unknown side." };
    }
    if (!isValidBranchId(candidate.strategy, candidate.branchId)) {
      return {
        ok: false,
        code: "invalid_payload",
        message: "branchId is invalid for the strategy.",
      };
    }
    if (!isLearningOutcome(candidate.outcome)) {
      return {
        ok: false,
        code: "invalid_payload",
        message: "Unknown outcome.",
      };
    }

    const observation: LearningObservation = {
      strategy: candidate.strategy,
      side: candidate.side,
      branchId: candidate.branchId,
      outcome: candidate.outcome,
    };
    const key = aggregateKey(observation);
    const previousOutcome = outcomesByKey.get(key);
    if (
      previousOutcome !== undefined &&
      previousOutcome !== observation.outcome
    ) {
      return {
        ok: false,
        code: "invalid_payload",
        message: "Duplicate observations have conflicting outcomes.",
      };
    }
    outcomesByKey.set(key, observation.outcome);
    observations.push(observation);
  }

  return {
    ok: true,
    value: {
      schemaVersion: SHARED_LEARNING_SCHEMA_VERSION,
      eventId: value.eventId.toLowerCase(),
      observations,
    },
  };
}

function aggregateKey(
  observation: Pick<LearningObservation, "strategy" | "side" | "branchId">,
): string {
  return `${observation.strategy}\u001f${observation.side}\u001f${observation.branchId}`;
}

export function collapseObservations(
  observations: readonly LearningObservation[],
): AggregateDelta[] {
  const deltas = new Map<string, AggregateDelta>();

  for (const observation of observations) {
    const key = aggregateKey(observation);
    if (deltas.has(key)) {
      continue;
    }

    deltas.set(key, {
      strategy: observation.strategy,
      side: observation.side,
      branchId: observation.branchId,
      games: 1,
      wins: observation.outcome === "win" ? 1 : 0,
      draws: observation.outcome === "draw" ? 1 : 0,
      scoreSum:
        observation.outcome === "win"
          ? 1
          : observation.outcome === "draw"
            ? 0.5
            : 0,
    });
  }

  return [...deltas.values()];
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function toPublicAggregateRecord(
  row: AggregateDatabaseRow,
): PublicAggregateRecord | null {
  if (
    !isStrategyId(row.strategy) ||
    !isLearningSide(row.side) ||
    !isValidBranchId(row.strategy, row.branch_id) ||
    !isNonNegativeInteger(row.games) ||
    !isNonNegativeInteger(row.wins) ||
    !isNonNegativeInteger(row.draws) ||
    row.wins + row.draws > row.games ||
    typeof row.score_sum !== "number" ||
    !Number.isFinite(row.score_sum) ||
    row.score_sum < 0 ||
    row.score_sum > row.games ||
    row.score_sum * 2 !== row.wins * 2 + row.draws
  ) {
    return null;
  }

  return {
    strategy: row.strategy,
    side: row.side,
    branchId: row.branch_id,
    games: row.games,
    wins: row.wins,
    draws: row.draws,
    scoreSum: row.score_sum,
  };
}
