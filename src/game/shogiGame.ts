import {
  makeKifHeader,
  makeKifMoveOrDrop,
  normalizedKifLines,
  parseKifHeader,
  parseKifMoveOrDrop,
} from "shogiops/notation/kif";
import { initialSfen, makeSfen, parseSfen } from "shogiops/sfen";
import type { MoveOrDrop, NormalMove, Role, Square } from "shogiops/types";
import { makeUsi, parseUsi } from "shogiops/util";
import { pieceCanPromote, pieceForcePromote } from "shogiops/variant/util";

export interface MoveRecord {
  readonly usi: string;
  readonly kif: string;
}

export type GameResult =
  | { readonly kind: "checkmate"; readonly winner: "sente" | "gote" }
  | {
      readonly kind: "resignation";
      readonly winner: "sente" | "gote";
      readonly loser: "sente" | "gote";
    }
  | { readonly kind: "draw"; readonly reason: "repetition" | "stalemate" };

export type Selection =
  | { readonly kind: "board"; readonly square: Square }
  | { readonly kind: "hand"; readonly role: Role };

export interface ShogiGameState {
  readonly startingSfen: string;
  readonly sfen: string;
  readonly moves: readonly MoveRecord[];
  readonly positionHistory: readonly string[];
  readonly selection?: Selection;
  readonly legalDestinations: readonly Square[];
  readonly pendingPromotion?: NormalMove;
  readonly result?: GameResult;
  readonly message: string;
}

export type ShogiGameAction =
  | { readonly type: "square-selected"; readonly square: Square }
  | { readonly type: "hand-selected"; readonly role: Role }
  | { readonly type: "promotion-resolved"; readonly promote: boolean }
  | { readonly type: "sfen-imported"; readonly sfen: string }
  | { readonly type: "kif-imported"; readonly kif: string }
  | { readonly type: "usi-played"; readonly usi: string }
  | { readonly type: "resigned"; readonly loser: "sente" | "gote" }
  | { readonly type: "state-restored"; readonly state: ShogiGameState }
  | { readonly type: "reset" };

function positionKey(sfen: string) {
  return sfen.split(" ").slice(0, 3).join(" ");
}

function readPosition(sfen: string) {
  return parseSfen("standard", sfen, true).unwrap();
}

function messageFor(state: ShogiGameState) {
  if (state.result?.kind === "checkmate") {
    return `${state.result.winner === "sente" ? "先手" : "後手"}の勝ち（詰み）`;
  }
  if (state.result?.kind === "resignation") {
    const loser = state.result.loser === "sente" ? "先手" : "後手";
    const winner = state.result.winner === "sente" ? "先手" : "後手";
    return `${state.moves.length}手まで、${loser}の投了（${winner}の勝ち）`;
  }
  if (state.result?.reason === "repetition") return "千日手（同一局面4回）";
  if (state.result?.reason === "stalemate") return "引き分け";

  const pos = readPosition(state.sfen);
  const side = pos.turn === "sente" ? "先手" : "後手";
  return pos.isCheck() ? `${side}の手番・王手` : `${side}の手番`;
}

export function createInitialGameState(
  sfen = initialSfen("standard"),
): ShogiGameState {
  const normalized = makeSfen(readPosition(sfen));
  const state: ShogiGameState = {
    startingSfen: normalized,
    sfen: normalized,
    moves: [],
    positionHistory: [positionKey(normalized)],
    legalDestinations: [],
    message: "先手の手番",
  };
  return { ...state, message: messageFor(state) };
}

export function playMove(
  state: ShogiGameState,
  move: MoveOrDrop,
): ShogiGameState {
  if (state.result) return state;

  const pos = readPosition(state.sfen);
  if (!pos.isLegal(move)) return { ...state, message: "その手は指せません" };

  const lastDestination = pos.lastMoveOrDrop?.to;
  const kif = makeKifMoveOrDrop(pos, move, lastDestination) ?? makeUsi(move);
  pos.play(move);

  const sfen = makeSfen(pos);
  const key = positionKey(sfen);
  const positionHistory = [...state.positionHistory, key];
  const repetitions = positionHistory.filter((entry) => entry === key).length;
  const outcome = pos.outcome();
  let result: GameResult | undefined;

  if (repetitions >= 4) {
    result = { kind: "draw", reason: "repetition" };
  } else if (outcome?.result === "checkmate" && outcome.winner) {
    result = { kind: "checkmate", winner: outcome.winner };
  } else if (outcome?.result === "stalemate" || outcome?.result === "draw") {
    result = { kind: "draw", reason: "stalemate" };
  }

  const next: ShogiGameState = {
    ...state,
    sfen,
    moves: [...state.moves, { usi: makeUsi(move), kif }],
    positionHistory,
    legalDestinations: [],
    selection: undefined,
    pendingPromotion: undefined,
    result,
    message: "",
  };
  return { ...next, message: messageFor(next) };
}

export function playUsi(state: ShogiGameState, usi: string): ShogiGameState {
  const move = parseUsi(usi);
  return move
    ? playMove(state, move)
    : { ...state, message: "USI形式が不正です" };
}

function selectBoardSquare(
  state: ShogiGameState,
  square: Square,
): ShogiGameState {
  if (state.result || state.pendingPromotion) return state;

  const pos = readPosition(state.sfen);
  const target = pos.board.get(square);
  const selected = state.selection;

  if (selected && state.legalDestinations.includes(square)) {
    if (selected.kind === "hand") {
      return playMove(state, { role: selected.role, to: square });
    }

    const piece = pos.board.get(selected.square);
    if (!piece)
      return { ...state, selection: undefined, legalDestinations: [] };

    const move = { from: selected.square, to: square } satisfies NormalMove;
    const forced = pieceForcePromote("standard")(piece, square);
    const canPromote = pieceCanPromote("standard")(
      piece,
      selected.square,
      square,
      target,
    );

    if (canPromote && !forced) return { ...state, pendingPromotion: move };
    return playMove(state, forced ? { ...move, promotion: true } : move);
  }

  if (target?.color === pos.turn) {
    return {
      ...state,
      selection: { kind: "board", square },
      legalDestinations: [...pos.moveDests(square)],
      message: `${target.role}を選択`,
    };
  }

  if (selected) {
    return {
      ...state,
      message: "移動できるマスを選んでください",
    };
  }

  return state;
}

function selectHandRole(state: ShogiGameState, role: Role): ShogiGameState {
  if (state.result || state.pendingPromotion) return state;
  const pos = readPosition(state.sfen);
  if (pos.hands.color(pos.turn).get(role) < 1) return state;

  return {
    ...state,
    selection: { kind: "hand", role },
    legalDestinations: [...pos.dropDests({ color: pos.turn, role })],
    message: `${role}を打つ場所を選択`,
  };
}

export function importSfen(sfen: string): ShogiGameState {
  try {
    return createInitialGameState(sfen.trim());
  } catch {
    return {
      ...createInitialGameState(),
      message: "SFENを読み込めませんでした",
    };
  }
}

export function exportKif(state: ShogiGameState) {
  const header = makeKifHeader(readPosition(state.startingSfen));
  const moves = state.moves.map((move, index) => `${index + 1} ${move.kif}`);
  return [header, "手数----指手---------", ...moves].join("\n");
}

export function importKif(kif: string): ShogiGameState {
  try {
    if (!/(手合割：|手数----|後手の持駒：|先手の持駒：)/.test(kif)) {
      throw new Error("missing KIF structure");
    }
    const initialPosition = parseKifHeader(kif).unwrap();
    let state = createInitialGameState(makeSfen(initialPosition));
    let lastDestination: Square | undefined;

    for (const line of normalizedKifLines(kif)) {
      const move = parseKifMoveOrDrop(line, lastDestination);
      if (!move) continue;

      const pos = readPosition(state.sfen);
      if (!pos.isLegal(move)) throw new Error("illegal KIF move");
      state = playMove(state, move);
      lastDestination = move.to;
    }
    return state;
  } catch {
    return {
      ...createInitialGameState(),
      message: "KIFを読み込めませんでした",
    };
  }
}

export function shogiGameReducer(
  state: ShogiGameState,
  action: ShogiGameAction,
): ShogiGameState {
  switch (action.type) {
    case "square-selected":
      return selectBoardSquare(state, action.square);
    case "hand-selected":
      return selectHandRole(state, action.role);
    case "promotion-resolved":
      return state.pendingPromotion
        ? playMove(state, {
            ...state.pendingPromotion,
            promotion: action.promote || undefined,
          })
        : state;
    case "sfen-imported": {
      const imported = importSfen(action.sfen);
      return imported.message === "SFENを読み込めませんでした"
        ? { ...state, message: imported.message }
        : imported;
    }
    case "kif-imported": {
      const imported = importKif(action.kif);
      return imported.message === "KIFを読み込めませんでした"
        ? { ...state, message: imported.message }
        : imported;
    }
    case "usi-played":
      return playUsi(state, action.usi);
    case "resigned": {
      if (state.result) return state;
      const winner = action.loser === "sente" ? "gote" : "sente";
      const resigned = {
        ...state,
        selection: undefined,
        legalDestinations: [],
        pendingPromotion: undefined,
        result: { kind: "resignation", winner, loser: action.loser } as const,
        message: "",
      };
      return { ...resigned, message: messageFor(resigned) };
    }
    case "state-restored":
      return action.state;
    case "reset":
      return createInitialGameState();
  }
}
