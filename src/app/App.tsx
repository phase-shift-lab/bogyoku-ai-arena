import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { parseSfen } from "shogiops/sfen";

import { classifyMoveAudio, gameAudio } from "../audio/gameAudio";
import { RecordTools } from "../components/RecordTools";
import { ShogiBoard } from "../components/ShogiBoard";
import { StrategyPicker } from "../components/StrategyPicker";
import { VariationTree } from "../components/VariationTree";
import { YaneuraOuClient } from "../engine/YaneuraOuClient";
import { getRuntimeCapabilities } from "../engine/runtimeCapabilities";
import type { PrincipalVariation, SearchResult } from "../engine/usiTypes";
import {
  indexedDbGameRepository,
  restoreGame,
  serializeGame,
} from "../game/gamePersistence";
import type { GameMode } from "../game/gameTypes";
import {
  positionPresetById,
  positionPresetIdForSfen,
  positionPresets,
  type PositionPresetId,
} from "../game/positionPresets";
import {
  createInitialGameState,
  shogiGameReducer,
  type ShogiGameState,
} from "../game/shogiGame";
import { chooseBogyokuResult } from "../strategy/bogyoku/decision";
import {
  profileForIntensity,
  surpriseLossLimitCp,
} from "../strategy/bogyoku/profile";
import { filterTacticallySafeVariations } from "../strategy/bogyoku/safety";
import {
  rankBogyokuMoves,
  type RankedBogyokuMove,
} from "../strategy/bogyoku/scoring";
import {
  bogyokuStateLabels,
  resolveBogyokuPlan,
  type BogyokuState,
} from "../strategy/bogyoku/stateMachine";
import {
  chooseRandomSurpriseStrategy,
  openingCandidateDetails,
  strategyOption,
  type OpeningCandidate,
  type StrategyId,
  type StrategySelectionMode,
} from "../strategy/openings/catalog";
import {
  createInitialLearningState,
  learningBranchMultiplier,
  learningStrategyMultiplier,
  parseLearningState,
  recordLearningGame,
  setLearningEnabled,
  type LearningObservation,
  type LearningSide,
  type LearningState,
} from "../strategy/learning/model";
import { learningRepository } from "../strategy/learning/repository";
import {
  createSharedLearningEvent,
  sharedLearningBranchMultiplier,
  sharedLearningStrategyMultiplier,
  type SharedLearningAggregate,
} from "../strategy/learning/shared";
import { sharedLearningRepository } from "../strategy/learning/sharedRepository";
import { appReducer, initialAppState } from "./appReducer";
import { scheduleAutoReset } from "./autoReset";

const modes: ReadonlyArray<{ id: GameMode; label: string; detail: string }> = [
  { id: "human-vs-ai", label: "人間 vs AI", detail: "棒玉AIと対局" },
  { id: "ai-vs-ai", label: "AI vs AI", detail: "戦型を観戦" },
  { id: "analysis", label: "解析", detail: "MultiPVで研究" },
];

const levels = [
  { id: "very-quick", label: "最速", moveTimeMs: 150 },
  { id: "quick", label: "速い", moveTimeMs: 300 },
  { id: "standard", label: "標準", moveTimeMs: 900 },
  { id: "deep", label: "深い", moveTimeMs: 2500 },
  { id: "very-deep", label: "最深", moveTimeMs: 5000 },
] as const;

const statusLabels = {
  idle: "待機中",
  ready: "準備完了",
  playing: "対局中",
  thinking: "思考中",
  paused: "一時停止",
  finished: "終局",
  error: "エラー",
} as const;

const sharedLearningConsentKey = "bogyoku-ai-arena:shared-learning-consent";

type SharedLearningStatus =
  | "disabled"
  | "unconfigured"
  | "loading"
  | "ready"
  | "sending"
  | "sent"
  | "unavailable";

const sharedLearningStatusLabels: Record<SharedLearningStatus, string> = {
  disabled: "共有学習OFF",
  unconfigured: "共有API未設定（端末内のみ）",
  loading: "共有データ読込中",
  ready: "共有データ反映中",
  sending: "匿名結果を送信中",
  sent: "匿名結果を共有済み",
  unavailable: "共有API利用不可（端末内のみ）",
};

function loadSharedLearningConsent(): boolean {
  try {
    return (
      typeof localStorage !== "undefined" &&
      localStorage.getItem(sharedLearningConsentKey) === "true"
    );
  } catch {
    return false;
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

interface StrategyDiagnostics {
  readonly state: BogyokuState;
  readonly ranked: readonly RankedBogyokuMove[];
  readonly rejected: readonly string[];
}

function rollRangingRookSides() {
  return {
    sente: Math.random() < 0.1,
    gote: Math.random() < 0.1,
  } as const;
}

function resolveConfiguredStrategy(
  mode: StrategySelectionMode,
  specified: StrategyId,
  intensity: number,
  side: LearningSide,
  learning: LearningState,
  sharedLearning: SharedLearningAggregate | undefined,
): StrategyId {
  if (mode === "normal") return "normal";
  if (mode === "specified")
    return specified === "normal" ? "bogyoku" : specified;
  return chooseRandomSurpriseStrategy(
    intensity,
    Math.random,
    (strategy) =>
      learningStrategyMultiplier(learning, strategy, side) *
      sharedLearningStrategyMultiplier(sharedLearning, strategy, side),
  );
}

function chooseWeightedOpeningCandidate(
  candidates: readonly OpeningCandidate[],
  weightFor: (candidate: OpeningCandidate) => number,
) {
  if (candidates.length === 0) return undefined;
  const weighted = candidates.map((candidate) => ({
    candidate,
    weight: Math.max(0.05, candidate.baseWeight * weightFor(candidate)),
  }));
  let cursor =
    Math.random() * weighted.reduce((sum, item) => sum + item.weight, 0);
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.candidate;
  }
  return weighted.at(-1)?.candidate;
}

function configuredStrategyLabel(
  mode: StrategySelectionMode,
  specified: StrategyId,
  resolved: StrategyId | null,
) {
  if (resolved) return strategyOption(resolved)?.label ?? "通常";
  if (mode === "normal") return "通常";
  if (mode === "auto") return "奇襲おまかせ";
  return strategyOption(specified)?.label ?? "棒玉";
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [game, gameDispatch] = useReducer(
    shogiGameReducer,
    undefined,
    createInitialGameState,
  );
  const [levelId, setLevelId] =
    useState<(typeof levels)[number]["id"]>("standard");
  const [aiStyle, setAiStyle] = useState<StrategyId>("bogyoku");
  const [senteAiStyle, setSenteAiStyle] = useState<StrategyId>("normal");
  const [aiStrategyMode, setAiStrategyMode] =
    useState<StrategySelectionMode>("specified");
  const [senteAiStrategyMode, setSenteAiStrategyMode] =
    useState<StrategySelectionMode>("normal");
  const [resolvedAiStyle, setResolvedAiStyle] = useState<StrategyId | null>(
    null,
  );
  const [resolvedSenteAiStyle, setResolvedSenteAiStyle] =
    useState<StrategyId | null>(null);
  const [aiStrategyTab, setAiStrategyTab] = useState<"sente" | "gote">("gote");
  const [senteLevelId, setSenteLevelId] =
    useState<(typeof levels)[number]["id"]>("standard");
  const [goteLevelId, setGoteLevelId] =
    useState<(typeof levels)[number]["id"]>("standard");
  const [bogyokuIntensity, setBogyokuIntensity] = useState(50);
  const [humanSideChoice, setHumanSideChoice] = useState<
    "sente" | "gote" | "random"
  >("sente");
  const [resolvedHumanSide, setResolvedHumanSide] = useState<"sente" | "gote">(
    "sente",
  );
  const [positionPresetId, setPositionPresetId] =
    useState<PositionPresetId>("flat");
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [stepMode, setStepMode] = useState(false);
  const [showCandidates, setShowCandidates] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(60);
  const [rangingRookSides, setRangingRookSides] =
    useState(rollRangingRookSides);
  const [variations, setVariations] = useState<readonly PrincipalVariation[]>(
    [],
  );
  const [engineMessage, setEngineMessage] = useState("エンジン起動中");
  const [engineReady, setEngineReady] = useState(false);
  const [activeRuntime, setActiveRuntime] = useState<"single" | "threaded">(
    "single",
  );
  const [strategyDiagnostics, setStrategyDiagnostics] =
    useState<StrategyDiagnostics>({
      state: "PREPARE",
      ranked: [],
      rejected: [],
    });
  const [learningState, setLearningState] = useState<LearningState>(
    createInitialLearningState,
  );
  const [learningLoaded, setLearningLoaded] = useState(false);
  const [sharedLearningConsent, setSharedLearningConsent] = useState(
    loadSharedLearningConsent,
  );
  const [storedSharedLearningAggregate, setStoredSharedLearningAggregate] =
    useState<SharedLearningAggregate | undefined>();
  const [sharedLearningRemoteStatus, setSharedLearningRemoteStatus] =
    useState<SharedLearningStatus>("loading");
  const sharedLearningAggregate =
    sharedLearningConsent && sharedLearningRepository.configured
      ? storedSharedLearningAggregate
      : undefined;
  const sharedLearningStatus: SharedLearningStatus =
    !sharedLearningRepository.configured
      ? "unconfigured"
      : !sharedLearningConsent
        ? "disabled"
        : sharedLearningRemoteStatus;
  const engineRef = useRef<YaneuraOuClient | undefined>(undefined);
  const searchGeneration = useRef(0);
  const didInteractRef = useRef(false);
  const previousGameRef = useRef(game);
  const learningObservationsRef = useRef<LearningObservation[]>([]);
  const learningImportRef = useRef<HTMLInputElement>(null);
  const runtime = useMemo(() => getRuntimeCapabilities(), []);
  const engineAutostartDisabled = useMemo(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("engine") === "off",
    [],
  );
  const profile = useMemo(
    () => profileForIntensity(bogyokuIntensity),
    [bogyokuIntensity],
  );
  const gameTurn = parseSfen("standard", game.sfen, true).unwrap().turn;
  const effectiveAiStyle =
    resolvedAiStyle ?? (aiStrategyMode === "specified" ? aiStyle : "normal");
  const effectiveSenteAiStyle =
    resolvedSenteAiStyle ??
    (senteAiStrategyMode === "specified" ? senteAiStyle : "normal");
  const activeStrategyId =
    state.mode === "ai-vs-ai" && gameTurn === "sente"
      ? effectiveSenteAiStyle
      : effectiveAiStyle;
  const activeStrategy =
    strategyOption(activeStrategyId) ?? strategyOption("normal")!;
  const level = levels.find((item) => item.id === levelId) ?? levels[2];
  const senteLevel =
    levels.find((item) => item.id === senteLevelId) ?? levels[2];
  const goteLevel = levels.find((item) => item.id === goteLevelId) ?? levels[2];
  const gameFinished = Boolean(game.result) || state.status === "finished";
  const visibleStatus = gameFinished ? "finished" : state.status;

  useEffect(() => {
    gameAudio.configure(soundEnabled, soundVolume / 100);
  }, [soundEnabled, soundVolume]);

  useEffect(() => {
    const previous = previousGameRef.current;
    const justFinished = !previous.result && Boolean(game.result);
    if (
      didInteractRef.current &&
      previous.startingSfen === game.startingSfen &&
      game.moves.length === previous.moves.length + 1
    ) {
      const usi = game.moves.at(-1)?.usi;
      if (usi)
        gameAudio.playMove(classifyMoveAudio(previous.sfen, game.sfen, usi));
    }
    if (didInteractRef.current && justFinished) gameAudio.playFinish();
    previousGameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (engineAutostartDisabled) {
      return undefined;
    }

    let alive = true;
    const client = new YaneuraOuClient();
    engineRef.current = client;
    void (async () => {
      try {
        await client.initialize({
          runtime: runtime.recommendedRuntime,
          threads: runtime.recommendedThreads,
          hashMb: runtime.recommendedHashMb,
          multiPv: 8,
        });
        if (!alive) return;
        setActiveRuntime(runtime.recommendedRuntime);
        setEngineReady(true);
        setEngineMessage("YaneuraOu 準備完了");
      } catch (primaryError) {
        if (!alive) return;
        if (runtime.recommendedRuntime !== "threaded") throw primaryError;
        console.warn("Threaded版YaneuraOuの初期化に失敗しました", primaryError);
        setEngineMessage("Threaded起動失敗。Singleへ切替中…");
        await client.restart({
          runtime: "single",
          threads: 1,
          hashMb: Math.min(runtime.recommendedHashMb, 64),
          multiPv: 8,
        });
        if (!alive) return;
        setActiveRuntime("single");
        setEngineReady(true);
        setEngineMessage("YaneuraOu 準備完了（Singleへ自動切替）");
      }
    })().catch((error: unknown) => {
      if (!alive) return;
      setEngineReady(false);
      setEngineMessage(
        `エンジン未接続: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return () => {
      alive = false;
      client.dispose();
    };
  }, [engineAutostartDisabled, runtime]);

  useEffect(() => {
    void indexedDbGameRepository.load().then((value) => {
      const restored = value ? restoreGame(value) : undefined;
      if (restored && !didInteractRef.current) {
        gameDispatch({ type: "state-restored", state: restored });
        setPositionPresetId(positionPresetIdForSfen(restored.startingSfen));
      }
    });
  }, []);

  useEffect(() => {
    void indexedDbGameRepository.save(serializeGame(game));
  }, [game]);

  useEffect(() => {
    let alive = true;
    void learningRepository
      .load()
      .then((stored) => {
        if (alive && stored) setLearningState(stored);
      })
      .catch((error: unknown) => {
        if (alive && !isAbortError(error)) {
          console.warn("端末内学習データを読み込めませんでした", error);
        }
      })
      .finally(() => {
        if (alive) setLearningLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!learningLoaded) return;
    void learningRepository.save(learningState).catch((error: unknown) => {
      if (!isAbortError(error)) {
        console.warn("端末内学習データを保存できませんでした", error);
      }
    });
  }, [learningLoaded, learningState]);

  useEffect(() => {
    try {
      if (sharedLearningConsent) {
        localStorage.setItem(sharedLearningConsentKey, "true");
      } else {
        localStorage.removeItem(sharedLearningConsentKey);
      }
    } catch {
      // Storage failure must never block local play.
    }

    if (!sharedLearningConsent || !sharedLearningRepository.configured) return;

    let alive = true;
    void sharedLearningRepository
      .loadAggregate()
      .then((value) => {
        if (!alive) return;
        setStoredSharedLearningAggregate(value);
        setSharedLearningRemoteStatus(value ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!alive) return;
        setStoredSharedLearningAggregate(undefined);
        setSharedLearningRemoteStatus("unavailable");
      });
    return () => {
      alive = false;
    };
  }, [sharedLearningConsent]);

  useEffect(() => {
    if (!game.result) return;
    const observations = learningObservationsRef.current;
    learningObservationsRef.current = [];
    if (observations.length === 0) return;
    const unique = [
      ...new Map(
        observations.map((observation) => [
          `${observation.strategy}|${observation.side}|${observation.branchId}`,
          observation,
        ]),
      ).values(),
    ];
    const winner = "winner" in game.result ? game.result.winner : undefined;
    const gameObservations = unique.map((observation) => ({
      ...observation,
      outcome:
        winner === undefined
          ? ("draw" as const)
          : winner === observation.side
            ? ("win" as const)
            : ("loss" as const),
    }));
    const outcomeId = JSON.stringify([
      game.startingSfen,
      game.moves.map((move) => move.usi),
      game.result,
    ]);
    setLearningState((current) =>
      recordLearningGame(current, outcomeId, gameObservations),
    );

    if (
      state.mode === "human-vs-ai" &&
      sharedLearningConsent &&
      sharedLearningRepository.configured
    ) {
      const event = createSharedLearningEvent(gameObservations);
      if (event) {
        setSharedLearningRemoteStatus("sending");
        void sharedLearningRepository
          .submitEvent(event)
          .then((accepted) =>
            setSharedLearningRemoteStatus(accepted ? "sent" : "unavailable"),
          )
          .catch(() => setSharedLearningRemoteStatus("unavailable"));
      }
    }
  }, [
    game.moves,
    game.result,
    game.startingSfen,
    sharedLearningConsent,
    state.mode,
  ]);

  const runSearch = useCallback(
    async (
      current: ShogiGameState,
      style: StrategyId,
      moveTimeMs = level.moveTimeMs,
      trackLearning = true,
    ): Promise<SearchResult> => {
      const client = engineRef.current;
      if (!client) throw new Error("エンジンを起動中です");
      const baseRequest = { sfen: current.sfen, moveTimeMs };
      if (style === "normal") {
        setStrategyDiagnostics({ state: "DISABLED", ranked: [], rejected: [] });
        return await client.search(baseRequest);
      }

      if (style !== "bogyoku") {
        const side = parseSfen("standard", current.sfen, true).unwrap().turn;
        const candidates = openingCandidateDetails(
          style,
          current.sfen,
          current.moves.map((move) => move.usi),
        );
        setStrategyDiagnostics({ state: "DISABLED", ranked: [], rejected: [] });
        if (candidates.length === 0) return await client.search(baseRequest);
        const chosen = chooseWeightedOpeningCandidate(
          candidates,
          (candidate) =>
            learningBranchMultiplier(
              learningState,
              style,
              side,
              candidate.branchId,
            ) *
            sharedLearningBranchMultiplier(
              sharedLearningAggregate,
              style,
              side,
              candidate.branchId,
            ),
        );
        if (!chosen) return await client.search(baseRequest);
        const probe = await client.search({
          ...baseRequest,
          moveTimeMs: Math.max(180, Math.floor(moveTimeMs * 0.45)),
        });
        const result = await client.search({
          ...baseRequest,
          searchMoves: [chosen.usi],
        });
        const baseline = probe.variations[0];
        const planned = result.variations[0];
        const withinSafetyLimit =
          planned?.mate !== undefined
            ? planned.mate > 0
            : baseline?.scoreCp === undefined ||
              planned?.scoreCp === undefined ||
              planned.scoreCp >=
                baseline.scoreCp - surpriseLossLimitCp(bogyokuIntensity);
        if (withinSafetyLimit && trackLearning) {
          learningObservationsRef.current.push({
            strategy: style,
            side,
            branchId: chosen.branchId,
            openingEvalCp: planned?.scoreCp,
          });
        }
        return withinSafetyLimit ? result : probe;
      }

      const probe = await client.search({
        ...baseRequest,
        moveTimeMs: Math.max(180, Math.floor(moveTimeMs * 0.45)),
      });
      const strategyEnabled = Object.values(profile.weights).some(
        (weight) => weight > 0,
      );
      if (!strategyEnabled) {
        setStrategyDiagnostics({ state: "DISABLED", ranked: [], rejected: [] });
        return probe;
      }
      const plan = resolveBogyokuPlan({
        enabled: true,
        sfen: current.sfen,
        evaluationCp: probe.variations[0]?.scoreCp,
        ply: current.moves.length,
        openingPlyLimit: profile.openingPlyLimit,
        history: current.moves.map((move) => move.usi),
        rangingRookEnabled:
          rangingRookSides[
            parseSfen("standard", current.sfen, true).unwrap().turn
          ],
      });
      const strategyState = plan.state;
      const safety = filterTacticallySafeVariations(
        probe.variations,
        profile.tacticalLossLimitCp,
        undefined,
        {
          plannedMoves: plan.candidates,
          plannedMoveLossLimitCp: profile.plannedMoveLossLimitCp,
        },
      );
      const safeMoves = safety.accepted.flatMap((variation) =>
        variation.pv[0] ? [variation.pv[0]] : [],
      );
      const ranked = rankBogyokuMoves(
        safeMoves,
        current.moves.length,
        profile,
        strategyState,
        plan.side,
        [...plan.candidates, ...plan.evaluationCandidates],
      );
      const candidates = [
        ...new Set([
          ...plan.candidates,
          ...plan.evaluationCandidates,
          ...ranked.map((item) => item.usi),
        ]),
      ].slice(0, 8);
      if (candidates.length === 0) {
        setStrategyDiagnostics({
          state: strategyState,
          ranked,
          rejected: safety.rejected.map(
            (item) => `${item.variation.pv[0] ?? "-"}: ${item.reason}`,
          ),
        });
        return probe;
      }

      const result = await client.search({
        ...baseRequest,
        searchMoves: candidates,
      });
      const finalSafety = filterTacticallySafeVariations(
        result.variations,
        profile.tacticalLossLimitCp,
        probe.variations[0]?.scoreCp,
        {
          plannedMoves: plan.candidates,
          plannedMoveLossLimitCp: profile.plannedMoveLossLimitCp,
        },
      );
      const finalMoves = finalSafety.accepted.flatMap((variation) =>
        variation.pv[0] ? [variation.pv[0]] : [],
      );
      const finalRanked = rankBogyokuMoves(
        finalMoves,
        current.moves.length,
        profile,
        strategyState,
        plan.side,
        [...plan.candidates, ...plan.evaluationCandidates],
      );
      setStrategyDiagnostics({
        state: strategyState,
        ranked: finalRanked,
        rejected: finalSafety.rejected.map(
          (item) => `${item.variation.pv[0] ?? "-"}: ${item.reason}`,
        ),
      });
      const chosen = chooseBogyokuResult(
        result,
        finalSafety.accepted,
        finalRanked,
        plan.candidates,
      );
      if (
        trackLearning &&
        chosen.bestmove !== "resign" &&
        chosen.bestmove !== "win"
      ) {
        const chosenVariation = chosen.variations.find(
          (variation) => variation.pv[0] === chosen.bestmove,
        );
        learningObservationsRef.current.push({
          strategy: "bogyoku",
          side: plan.side,
          branchId: `bogyoku:${rangingRookSides[plan.side] ? "ranging-" : ""}${strategyState.toLowerCase()}`,
          openingEvalCp:
            chosenVariation?.scoreCp ?? chosen.variations[0]?.scoreCp,
        });
      }
      return chosen;
    },
    [
      bogyokuIntensity,
      learningState,
      level.moveTimeMs,
      profile,
      rangingRookSides,
      sharedLearningAggregate,
    ],
  );

  const synchronizeAiTurn = useCallback(() => {
    if (game.result) {
      dispatch({ type: "game-finished" });
      return;
    }
    if (state.status !== "playing") return;
    const position = parseSfen("standard", game.sfen, true).unwrap();
    const aiTurn =
      state.mode === "ai-vs-ai" ||
      (state.mode === "human-vs-ai" && position.turn !== resolvedHumanSide);
    if (!aiTurn) return;
    const generation = ++searchGeneration.current;
    dispatch({ type: "engine-thinking" });
    setEngineMessage("探索中…");
    const style =
      state.mode === "ai-vs-ai" && position.turn === "sente"
        ? effectiveSenteAiStyle
        : effectiveAiStyle;
    const moveTimeMs =
      state.mode === "ai-vs-ai"
        ? position.turn === "sente"
          ? senteLevel.moveTimeMs
          : goteLevel.moveTimeMs
        : level.moveTimeMs;
    void runSearch(game, style, moveTimeMs)
      .then((result) => {
        if (searchGeneration.current !== generation) return;
        setVariations(result.variations);
        if (result.bestmove === "resign") {
          gameDispatch({ type: "resigned", loser: position.turn });
          dispatch({ type: "game-finished" });
          setEngineMessage("AIが投了しました");
          return;
        }
        if (result.bestmove === "win") {
          gameDispatch({ type: "declared", winner: position.turn });
          dispatch({ type: "game-finished" });
          setEngineMessage("AIが入玉宣言しました");
          return;
        }
        gameDispatch({ type: "usi-played", usi: result.bestmove });
        dispatch({ type: stepMode ? "game-paused" : "engine-ready" });
        if (stepMode) setStepMode(false);
        setEngineMessage(`指し手 ${result.bestmove}`);
      })
      .catch((error: unknown) => {
        dispatch({ type: "engine-error" });
        setEngineMessage(
          error instanceof Error ? error.message : String(error),
        );
      });
  }, [
    effectiveAiStyle,
    effectiveSenteAiStyle,
    game,
    goteLevel.moveTimeMs,
    level.moveTimeMs,
    resolvedHumanSide,
    runSearch,
    senteLevel.moveTimeMs,
    state.mode,
    state.status,
    stepMode,
  ]);

  useEffect(() => {
    const task = window.setTimeout(synchronizeAiTurn, 0);
    return () => window.clearTimeout(task);
  }, [synchronizeAiTurn]);

  const resetGame = useCallback(
    (presetId: PositionPresetId = positionPresetId) => {
      didInteractRef.current = true;
      searchGeneration.current += 1;
      engineRef.current?.stop();
      dispatch({ type: "game-reset" });
      setPositionPresetId(presetId);
      gameDispatch({
        type: "sfen-imported",
        sfen: positionPresetById(presetId).sfen,
      });
      setVariations([]);
      setStepMode(false);
      setRangingRookSides(rollRangingRookSides());
      setResolvedAiStyle(null);
      setResolvedSenteAiStyle(null);
      learningObservationsRef.current = [];
      setStrategyDiagnostics({ state: "PREPARE", ranked: [], rejected: [] });
      void indexedDbGameRepository.clear();
    },
    [positionPresetId],
  );

  useEffect(() => {
    if (!gameFinished) return undefined;
    return scheduleAutoReset(() => resetGame());
  }, [gameFinished, resetGame]);

  const startGame = () => {
    didInteractRef.current = true;
    void gameAudio.unlock().then(() => {
      if (state.status !== "paused") gameAudio.playStart();
    });
    let nextHumanSide = resolvedHumanSide;
    if (state.status !== "paused" && state.mode === "human-vs-ai") {
      const side =
        humanSideChoice === "random"
          ? Math.random() < 0.5
            ? "sente"
            : "gote"
          : humanSideChoice;
      nextHumanSide = side;
      setResolvedHumanSide(side);
      setBoardFlipped(side === "gote");
    }
    if (state.status !== "paused") {
      const configuredAiSide: LearningSide =
        state.mode === "human-vs-ai"
          ? nextHumanSide === "sente"
            ? "gote"
            : "sente"
          : "gote";
      setResolvedAiStyle(
        resolveConfiguredStrategy(
          aiStrategyMode,
          aiStyle,
          bogyokuIntensity,
          configuredAiSide,
          learningState,
          sharedLearningAggregate,
        ),
      );
      setResolvedSenteAiStyle(
        resolveConfiguredStrategy(
          senteAiStrategyMode,
          senteAiStyle,
          bogyokuIntensity,
          "sente",
          learningState,
          sharedLearningAggregate,
        ),
      );
    }
    dispatch({ type: "game-started" });
  };

  const resignGame = () => {
    const loser =
      state.mode === "human-vs-ai"
        ? resolvedHumanSide
        : parseSfen("standard", game.sfen, true).unwrap().turn;
    const sideLabel = loser === "sente" ? "先手" : "後手";
    if (!window.confirm(`${sideLabel}が投了します。よろしいですか？`)) return;
    searchGeneration.current += 1;
    engineRef.current?.stop();
    gameDispatch({ type: "resigned", loser });
    dispatch({ type: "game-finished" });
  };

  const swapAiSidesAndRestart = () => {
    void gameAudio.unlock().then(() => gameAudio.playStart());
    const previousStyle = senteAiStyle;
    const previousMode = senteAiStrategyMode;
    const previousLevel = senteLevelId;
    setSenteAiStyle(aiStyle);
    setAiStyle(previousStyle);
    setSenteAiStrategyMode(aiStrategyMode);
    setAiStrategyMode(previousMode);
    setSenteLevelId(goteLevelId);
    setGoteLevelId(previousLevel);
    resetGame();
    setResolvedSenteAiStyle(
      resolveConfiguredStrategy(
        aiStrategyMode,
        aiStyle,
        bogyokuIntensity,
        "sente",
        learningState,
        sharedLearningAggregate,
      ),
    );
    setResolvedAiStyle(
      resolveConfiguredStrategy(
        previousMode,
        previousStyle,
        bogyokuIntensity,
        "gote",
        learningState,
        sharedLearningAggregate,
      ),
    );
    queueMicrotask(() => dispatch({ type: "game-started" }));
  };

  const analyze = async () => {
    dispatch({ type: "engine-thinking" });
    try {
      const result = await runSearch(
        game,
        effectiveAiStyle,
        level.moveTimeMs,
        false,
      );
      setVariations(result.variations);
      setEngineMessage(`推奨手 ${result.bestmove}`);
      dispatch({ type: "engine-ready" });
    } catch (error) {
      dispatch({ type: "engine-error" });
      setEngineMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const boardEnabled =
    state.status === "playing" &&
    !game.result &&
    (state.mode === "analysis" ||
      (state.mode === "human-vs-ai" &&
        parseSfen("standard", game.sfen, true).unwrap().turn ===
          resolvedHumanSide));
  const strategyLocked =
    state.status === "playing" ||
    state.status === "thinking" ||
    state.status === "paused";

  const updateAiStrategyMode = (mode: StrategySelectionMode) => {
    setAiStrategyMode(mode);
    setResolvedAiStyle(null);
    if (mode === "specified" && aiStyle === "normal") setAiStyle("bogyoku");
  };

  const updateSenteAiStrategyMode = (mode: StrategySelectionMode) => {
    setSenteAiStrategyMode(mode);
    setResolvedSenteAiStyle(null);
    if (mode === "specified" && senteAiStyle === "normal")
      setSenteAiStyle("bogyoku");
  };

  const toggleLearning = (enabled: boolean) => {
    setLearningState((current) => setLearningEnabled(current, enabled));
  };

  const exportLearning = () => {
    const blob = new Blob([JSON.stringify(learningState, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bogyoku-learning-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importLearningFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    try {
      if (!file) return;
      const imported = parseLearningState(await file.text());
      if (!imported) throw new Error("unsupported learning data");
      setLearningState(imported);
    } catch {
      window.alert(
        "学習データを読み込めませんでした。対応するJSONを選んでください。",
      );
    } finally {
      event.target.value = "";
    }
  };

  const resetLearning = () => {
    if (!window.confirm("この端末の奇襲学習データを消去しますか？")) return;
    const initial = createInitialLearningState();
    learningObservationsRef.current = [];
    setLearningState(initial);
    void learningRepository
      .clear()
      .then(() => learningRepository.save(initial));
  };

  return (
    <div className="app-shell">
      <main id="top" className="arena">
        <section
          className="hero-panel"
          aria-label="Bogyoku AI Arena 操作パネル"
        >
          <div className="side-brand-row">
            <a
              className="brand"
              href="#top"
              aria-label="Bogyoku AI Arena ホーム"
            >
              <span className="brand-mark" aria-hidden="true">
                玉
              </span>
              <span>
                <strong>Bogyoku AI Arena</strong>
                <small>棒玉特化・ブラウザ将棋研究所</small>
              </span>
            </a>
            <div className="runtime-badge" data-runtime={activeRuntime}>
              <span aria-hidden="true" />
              {activeRuntime === "threaded" ? "Threaded" : "Single"}
            </div>
          </div>
          <div className="mode-list" aria-label="対局モード">
            {modes.map((mode) => (
              <button
                aria-pressed={state.mode === mode.id}
                className="mode-card"
                key={mode.id}
                onClick={() =>
                  dispatch({ type: "mode-selected", mode: mode.id })
                }
                type="button"
              >
                <strong>{mode.label}</strong>
                <span>{mode.detail}</span>
              </button>
            ))}
          </div>
          {state.mode === "ai-vs-ai" ? (
            <div className="ai-strategy-selector">
              <div
                aria-label="AI戦型の設定対象"
                className="ai-side-tabs"
                role="tablist"
              >
                <button
                  aria-selected={aiStrategyTab === "sente"}
                  onClick={() => setAiStrategyTab("sente")}
                  role="tab"
                  type="button"
                >
                  先手AI
                </button>
                <button
                  aria-selected={aiStrategyTab === "gote"}
                  onClick={() => setAiStrategyTab("gote")}
                  role="tab"
                  type="button"
                >
                  後手AI
                </button>
              </div>
              {aiStrategyTab === "sente" ? (
                <StrategyPicker
                  disabled={strategyLocked}
                  label="先手AI戦型"
                  mode={senteAiStrategyMode}
                  onChange={(style) => {
                    setSenteAiStyle(style);
                    setResolvedSenteAiStyle(null);
                  }}
                  onModeChange={updateSenteAiStrategyMode}
                  resolvedValue={resolvedSenteAiStyle}
                  value={senteAiStyle}
                />
              ) : (
                <StrategyPicker
                  disabled={strategyLocked}
                  label="後手AI戦型"
                  mode={aiStrategyMode}
                  onChange={(style) => {
                    setAiStyle(style);
                    setResolvedAiStyle(null);
                  }}
                  onModeChange={updateAiStrategyMode}
                  resolvedValue={resolvedAiStyle}
                  value={aiStyle}
                />
              )}
              <p className="ai-strategy-summary">
                先手：
                {configuredStrategyLabel(
                  senteAiStrategyMode,
                  senteAiStyle,
                  resolvedSenteAiStyle,
                )}
                <span aria-hidden="true"> / </span>
                後手：
                {configuredStrategyLabel(
                  aiStrategyMode,
                  aiStyle,
                  resolvedAiStyle,
                )}
              </p>
            </div>
          ) : (
            <StrategyPicker
              disabled={strategyLocked}
              label="AI戦型"
              mode={aiStrategyMode}
              onChange={(style) => {
                setAiStyle(style);
                setResolvedAiStyle(null);
              }}
              onModeChange={updateAiStrategyMode}
              resolvedValue={resolvedAiStyle}
              value={aiStyle}
            />
          )}
          <div className="settings-grid">
            <label>
              奇襲強度 <output>{bogyokuIntensity}</output>
              <input
                aria-label="奇襲強度"
                type="range"
                min="0"
                max="100"
                step="5"
                value={bogyokuIntensity}
                onChange={(event) =>
                  setBogyokuIntensity(Number(event.target.value))
                }
              />
            </label>
            <label>
              開始局面
              <select
                disabled={
                  state.status === "playing" || state.status === "thinking"
                }
                value={positionPresetId}
                onChange={(event) =>
                  resetGame(event.target.value as PositionPresetId)
                }
              >
                {positionPresets.map((preset) => (
                  <option value={preset.id} key={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            {state.mode === "ai-vs-ai" ? (
              <>
                <label>
                  先手AI思考
                  <select
                    value={senteLevelId}
                    onChange={(event) =>
                      setSenteLevelId(
                        event.target.value as (typeof levels)[number]["id"],
                      )
                    }
                  >
                    {levels.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.label} ({item.moveTimeMs}ms)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  後手AI思考
                  <select
                    value={goteLevelId}
                    onChange={(event) =>
                      setGoteLevelId(
                        event.target.value as (typeof levels)[number]["id"],
                      )
                    }
                  >
                    {levels.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.label} ({item.moveTimeMs}ms)
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label>
                思考レベル
                <select
                  value={levelId}
                  onChange={(event) =>
                    setLevelId(
                      event.target.value as (typeof levels)[number]["id"],
                    )
                  }
                >
                  {levels.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.label} ({item.moveTimeMs}ms)
                    </option>
                  ))}
                </select>
              </label>
            )}
            {state.mode === "human-vs-ai" ? (
              <label>
                あなたの手番
                <select
                  disabled={
                    state.status === "playing" || state.status === "thinking"
                  }
                  value={humanSideChoice}
                  onChange={(event) =>
                    setHumanSideChoice(
                      event.target.value as "sente" | "gote" | "random",
                    )
                  }
                >
                  <option value="sente">先手</option>
                  <option value="gote">後手</option>
                  <option value="random">ランダム</option>
                </select>
              </label>
            ) : null}
            <label className="checkbox-setting">
              <input
                type="checkbox"
                checked={showCandidates}
                onChange={(event) => setShowCandidates(event.target.checked)}
              />
              候補手を表示
            </label>
            <label className="checkbox-setting">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => setSoundEnabled(event.target.checked)}
              />
              効果音
            </label>
            <label>
              音量 <output>{soundVolume}%</output>
              <input
                aria-label="音量"
                type="range"
                min="0"
                max="100"
                step="5"
                value={soundVolume}
                onChange={(event) => setSoundVolume(Number(event.target.value))}
              />
            </label>
          </div>
          <details className="learning-panel">
            <summary>
              <span>奇襲学習</span>
              <strong>{learningState.learnedGames}局</strong>
            </summary>
            <div className="learning-panel-body">
              <label className="learning-toggle">
                <input
                  checked={learningState.enabled}
                  onChange={(event) => toggleLearning(event.target.checked)}
                  type="checkbox"
                />
                奇襲定跡の選択を対局結果から調整
              </label>
              <div className="learning-actions">
                <button
                  className="secondary-button"
                  onClick={exportLearning}
                  type="button"
                >
                  JSON保存
                </button>
                <button
                  className="secondary-button"
                  onClick={() => learningImportRef.current?.click()}
                  type="button"
                >
                  JSON読込
                </button>
                <button
                  className="secondary-button"
                  onClick={resetLearning}
                  type="button"
                >
                  学習リセット
                </button>
              </div>
              <input
                ref={learningImportRef}
                accept="application/json"
                hidden
                onChange={importLearningFile}
                type="file"
              />
              <p>端末内学習データはこの端末に保存されます。</p>
              <div className="shared-learning-section">
                <label className="learning-toggle">
                  <input
                    checked={
                      sharedLearningConsent &&
                      sharedLearningRepository.configured
                    }
                    disabled={!sharedLearningRepository.configured}
                    onChange={(event) => {
                      setSharedLearningConsent(event.target.checked);
                      setStoredSharedLearningAggregate(undefined);
                      if (event.target.checked) {
                        setSharedLearningRemoteStatus("loading");
                      }
                    }}
                    type="checkbox"
                  />
                  匿名の共有学習に参加
                </label>
                <output
                  className={`shared-learning-status status-${sharedLearningStatus}`}
                >
                  {sharedLearningStatusLabels[sharedLearningStatus]}
                </output>
                <p>
                  送信するのは戦法・分岐ID・AI手番・勝敗・ランダムなイベントIDだけです。棋譜・局面・指し手・評価値・端末識別子は送信しません。
                </p>
              </div>
            </div>
          </details>
          <div className="control-row">
            <button
              className="primary-button"
              disabled={!engineReady || state.status === "thinking"}
              onClick={startGame}
              type="button"
            >
              {state.status === "paused"
                ? "再開"
                : engineReady
                  ? "対局を始める"
                  : "エンジン準備中"}
            </button>
            {state.status === "playing" || state.status === "thinking" ? (
              <button
                className="secondary-button"
                onClick={() => {
                  searchGeneration.current += 1;
                  engineRef.current?.stop();
                  dispatch({ type: "game-paused" });
                }}
                type="button"
              >
                一時停止
              </button>
            ) : null}
            {state.mode !== "analysis" &&
            (state.status === "playing" || state.status === "thinking") ? (
              <button
                className="secondary-button resign-button"
                onClick={resignGame}
                type="button"
              >
                投了
              </button>
            ) : null}
            {state.mode === "ai-vs-ai" && state.status === "paused" ? (
              <button
                className="secondary-button"
                onClick={() => {
                  setStepMode(true);
                  dispatch({ type: "game-started" });
                }}
                type="button"
              >
                一手進む
              </button>
            ) : null}
            {state.mode === "ai-vs-ai" ? (
              <button
                className="secondary-button"
                onClick={swapAiSidesAndRestart}
                type="button"
              >
                先後を入替えて再戦
              </button>
            ) : null}
            <button
              className="secondary-button"
              onClick={() => resetGame()}
              type="button"
            >
              リセット
            </button>
          </div>
        </section>

        <section className="game-panel" aria-label="対局盤面">
          <div className="game-toolbar">
            <div>
              <span className="label">戦型プロファイル</span>
              <strong>{activeStrategy.label}</strong>
            </div>
            <button
              className="toolbar-button"
              onClick={() => setBoardFlipped((value) => !value)}
              type="button"
            >
              盤面反転
            </button>
            <div className="status-chip" data-status={visibleStatus}>
              {statusLabels[visibleStatus]}
            </div>
          </div>
          <ShogiBoard
            dispatch={gameDispatch}
            enabled={boardEnabled}
            flipped={boardFlipped}
            state={game}
          />
          <div className="board-footer">
            <span>先手</span>
            <span>{game.moves.length}手目</span>
            <span>後手</span>
          </div>
        </section>

        <aside className="analysis-panel" aria-label="解析情報">
          <section>
            <div className="panel-heading">
              <span className="label">ENGINE</span>
              <strong>YaneuraOu / {activeRuntime}</strong>
            </div>
            <p className="engine-message" aria-live="polite">
              {engineMessage}
            </p>
            <dl className="stat-list">
              <div>
                <dt>Threads / Hash</dt>
                <dd>
                  {activeRuntime === "threaded"
                    ? runtime.recommendedThreads
                    : 1}{" "}
                  /{" "}
                  {activeRuntime === "threaded"
                    ? runtime.recommendedHashMb
                    : Math.min(runtime.recommendedHashMb, 64)}
                  MB
                </dd>
              </div>
              <div>
                <dt>MultiPV / 論理コア</dt>
                <dd>8 / {runtime.logicalCores}</dd>
              </div>
            </dl>
            {runtime.warning && <p className="warning">{runtime.warning}</p>}
          </section>
          <section>
            <div className="panel-heading">
              <span className="label">MULTIPV</span>
              <strong>候補手・変化</strong>
            </div>
            <button
              className="secondary-button analyze-button"
              disabled={!engineReady}
              onClick={() => void analyze()}
              type="button"
            >
              現在局面を解析
            </button>
            {showCandidates && variations[0] ? (
              <div className="evaluation-meter">
                <span>後手優勢</span>
                <meter
                  min="-1000"
                  max="1000"
                  value={Math.max(
                    -1000,
                    Math.min(1000, variations[0].scoreCp ?? 0),
                  )}
                />
                <span>先手優勢</span>
              </div>
            ) : null}
            {showCandidates ? (
              <VariationTree variations={variations} />
            ) : (
              <p className="empty-analysis">候補手を非表示中</p>
            )}
          </section>
          <section>
            <div className="panel-heading">
              <span className="label">STRATEGY</span>
              <strong>{activeStrategy.label}</strong>
            </div>
            <p className="strategy-copy">
              {activeStrategyId === "bogyoku"
                ? profile.description
                : activeStrategy.detail}
            </p>
            <dl className="stat-list">
              <div>
                <dt>現在段階</dt>
                <dd>{bogyokuStateLabels[strategyDiagnostics.state]}</dd>
              </div>
              <div>
                <dt>安全候補 / 除外</dt>
                <dd>
                  {strategyDiagnostics.ranked.length} /{" "}
                  {strategyDiagnostics.rejected.length}
                </dd>
              </div>
            </dl>
            <div className="feature-table">
              {Object.entries(profile.weights).map(([key, weight]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>
                    {weight > 0 ? "+" : ""}
                    {weight}
                  </strong>
                </div>
              ))}
            </div>
            {showCandidates && strategyDiagnostics.ranked[0] ? (
              <p className="strategy-copy">
                優先 {strategyDiagnostics.ranked[0].usi}:{" "}
                {strategyDiagnostics.ranked[0].score}点
              </p>
            ) : null}
            {showCandidates && strategyDiagnostics.rejected.length ? (
              <p className="warning">
                除外: {strategyDiagnostics.rejected.slice(0, 2).join(" / ")}
              </p>
            ) : null}
          </section>
          <RecordTools dispatch={gameDispatch} state={game} />
          <section className="privacy-note">
            <span aria-hidden="true">◈</span>
            <div>
              <strong>Local First</strong>
              <p>
                棋譜・局面・解析結果は外部送信しません。自動保存はIndexedDB内です。
              </p>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
