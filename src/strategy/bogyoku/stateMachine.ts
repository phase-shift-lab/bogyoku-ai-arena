import { parseSfen } from "shogiops/sfen";
import type { Color, Role } from "shogiops/types";
import { parseSquareName, parseUsi } from "shogiops/util";

export type BogyokuState =
  | "PREPARE"
  | "KING_ASCENT"
  | "KING_TRANSFER"
  | "BOGYOKU_ESTABLISHED"
  | "EVALUATED_ADVANCE"
  | "RANGING_ROOK"
  | "ATTACK_OR_CASTLE"
  | "EMERGENCY_ESCAPE"
  | "DISABLED";

export interface BogyokuPlan {
  readonly side: Color;
  readonly state: BogyokuState;
  readonly candidates: readonly string[];
  readonly evaluationCandidates: readonly string[];
}

export interface BogyokuPlanInput {
  readonly enabled: boolean;
  readonly sfen: string;
  readonly evaluationCp?: number;
  readonly ply: number;
  readonly openingPlyLimit: number;
  readonly history?: readonly string[];
  readonly rangingRookEnabled?: boolean;
}

interface SideRoute {
  readonly side: Color;
  readonly rookSquare: string;
  readonly preparation: readonly [string, string][];
  readonly kingRoute: readonly [string, BogyokuState, string][];
  readonly establishedKingSquares: readonly string[];
  readonly evaluatedAdvance: readonly [string, Role, string][];
  readonly rangingRookMoves: readonly string[];
}

const routes: Readonly<Record<Color, SideRoute>> = {
  sente: {
    side: "sente",
    rookSquare: "2h",
    preparation: [["2g", "2g2f"]],
    kingRoute: [
      ["5i", "KING_ASCENT", "5i4h"],
      ["4h", "KING_TRANSFER", "4h3h"],
      ["3h", "KING_TRANSFER", "3h2g"],
    ],
    establishedKingSquares: ["2g", "2f"],
    evaluatedAdvance: [
      ["2f", "pawn", "2f2e"],
      ["2g", "king", "2g2f"],
    ],
    rangingRookMoves: ["2h6h", "2h7h"],
  },
  gote: {
    side: "gote",
    rookSquare: "8b",
    preparation: [["8c", "8c8d"]],
    kingRoute: [
      ["5a", "KING_ASCENT", "5a6b"],
      ["6b", "KING_TRANSFER", "6b7b"],
      ["7b", "KING_TRANSFER", "7b8c"],
    ],
    establishedKingSquares: ["8c", "8d"],
    evaluatedAdvance: [
      ["8d", "pawn", "8d8e"],
      ["8c", "king", "8c8d"],
    ],
    rangingRookMoves: ["8b4b", "8b3b"],
  },
};

function pieceAt(sfen: string, squareName: string, color: Color, role: Role) {
  const position = parseSfen("standard", sfen, true).unwrap();
  const square = parseSquareName(squareName);
  const piece = square === undefined ? undefined : position.board.get(square);
  return piece?.color === color && piece.role === role;
}

function legalCandidates(sfen: string, usis: readonly string[]) {
  const position = parseSfen("standard", sfen, true).unwrap();
  return usis.filter((usi) => {
    const move = parseUsi(usi);
    return move && position.isLegal(move);
  });
}

function routeCompleted(
  history: readonly string[] | undefined,
  routeMoves: readonly string[],
) {
  if (!history) return false;
  let routeIndex = 0;
  for (const move of history) {
    if (move === routeMoves[routeIndex]) routeIndex += 1;
    if (routeIndex === routeMoves.length) return true;
  }
  return false;
}

export function resolveBogyokuPlan(input: BogyokuPlanInput): BogyokuPlan {
  const position = parseSfen("standard", input.sfen, true).unwrap();
  const route = routes[position.turn];
  let state: BogyokuState = "ATTACK_OR_CASTLE";
  let candidates: readonly string[] = [];
  let evaluationCandidates: readonly string[] = [];

  if (!input.enabled) state = "DISABLED";
  else if (
    position.isCheck() ||
    (input.evaluationCp !== undefined && input.evaluationCp <= -400)
  ) {
    state = "EMERGENCY_ESCAPE";
  } else if (input.ply >= input.openingPlyLimit) {
    state = "ATTACK_OR_CASTLE";
  } else {
    const completedOnce = routeCompleted(
      input.history,
      route.kingRoute.map(([, , move]) => move),
    );
    const preparation = route.preparation.find(([square]) =>
      pieceAt(input.sfen, square, route.side, "pawn"),
    );
    const kingStep = route.kingRoute.find(([square]) =>
      pieceAt(input.sfen, square, route.side, "king"),
    );
    const established = route.establishedKingSquares.some((square) =>
      pieceAt(input.sfen, square, route.side, "king"),
    );
    const evaluatedAdvance = route.evaluatedAdvance.find(([square, role]) =>
      pieceAt(input.sfen, square, route.side, role),
    );
    const rangingRookCompleted = input.history?.some((move) =>
      route.rangingRookMoves.includes(move),
    );

    if (
      completedOnce &&
      input.rangingRookEnabled &&
      !rangingRookCompleted &&
      pieceAt(input.sfen, route.rookSquare, route.side, "rook")
    ) {
      state = "RANGING_ROOK";
      candidates = route.rangingRookMoves;
    } else if (completedOnce && evaluatedAdvance) {
      state = "EVALUATED_ADVANCE";
      evaluationCandidates = [evaluatedAdvance[2]];
    } else if (
      completedOnce ||
      !pieceAt(input.sfen, route.rookSquare, route.side, "rook")
    ) {
      state = "ATTACK_OR_CASTLE";
    } else if (preparation) {
      state = "PREPARE";
      candidates = [preparation[1]];
    } else if (kingStep) {
      state = kingStep[1];
      candidates = [kingStep[2]];
    } else if (established) {
      state = "BOGYOKU_ESTABLISHED";
    }
  }

  return {
    side: route.side,
    state,
    candidates: legalCandidates(input.sfen, candidates),
    evaluationCandidates: legalCandidates(input.sfen, evaluationCandidates),
  };
}

export const bogyokuStateLabels: Readonly<Record<BogyokuState, string>> = {
  PREPARE: "飛車先を開ける",
  KING_ASCENT: "玉の前進",
  KING_TRANSFER: "玉の移送",
  BOGYOKU_ESTABLISHED: "飛車先の棒玉",
  EVALUATED_ADVANCE: "評価内で玉を進出",
  RANGING_ROOK: "振り飛車へ転換",
  ATTACK_OR_CASTLE: "攻撃・安全化",
  EMERGENCY_ESCAPE: "緊急退避",
  DISABLED: "無効",
};
