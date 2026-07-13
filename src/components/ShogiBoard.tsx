import { parseSfen } from "shogiops/sfen";
import type { Color, Role, Square } from "shogiops/types";
import { makeSquareName, parseCoordinates, parseUsi } from "shogiops/util";
import { handRoles } from "shogiops/variant/util";

import type { ShogiGameAction, ShogiGameState } from "../game/shogiGame";

const pieceLabels: Partial<Record<Role, string>> = {
  lance: "香",
  knight: "桂",
  silver: "銀",
  gold: "金",
  king: "玉",
  bishop: "角",
  rook: "飛",
  pawn: "歩",
  tokin: "と",
  promotedpawn: "と",
  promotedlance: "杏",
  promotedknight: "圭",
  promotedsilver: "全",
  horse: "馬",
  dragon: "龍",
};

const sideLabels: Record<Color, string> = { sente: "先手", gote: "後手" };
const files = [8, 7, 6, 5, 4, 3, 2, 1, 0] as const;
const ranks = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const rankLabels: Record<string, string> = {
  a: "一",
  b: "二",
  c: "三",
  d: "四",
  e: "五",
  f: "六",
  g: "七",
  h: "八",
  i: "九",
};

interface Props {
  readonly state: ShogiGameState;
  readonly dispatch: (action: ShogiGameAction) => void;
  readonly enabled: boolean;
  readonly flipped?: boolean;
}

function HandPieces({
  color,
  game,
  dispatch,
  enabled,
}: {
  readonly color: Color;
  readonly game: ShogiGameState;
  readonly dispatch: Props["dispatch"];
  readonly enabled: boolean;
}) {
  const pos = parseSfen("standard", game.sfen, true).unwrap();
  const hand = pos.hands.color(color);

  return (
    <div
      className="hand"
      data-side={color}
      aria-label={`${sideLabels[color]}の持ち駒`}
    >
      <strong>{sideLabels[color]}</strong>
      <div>
        {handRoles("standard").map((role) => {
          const count = hand.get(role);
          const selected =
            game.selection?.kind === "hand" && game.selection.role === role;
          return count > 0 ? (
            <button
              aria-pressed={selected}
              className="hand-piece"
              disabled={!enabled || color !== pos.turn}
              key={role}
              onClick={() => dispatch({ type: "hand-selected", role })}
              type="button"
            >
              {pieceLabels[role] ?? role}
              <small>{count}</small>
            </button>
          ) : null;
        })}
        {hand.isEmpty() && <span className="empty-hand">なし</span>}
      </div>
    </div>
  );
}

export function ShogiBoard({
  state,
  dispatch,
  enabled,
  flipped = false,
}: Props) {
  const pos = parseSfen("standard", state.sfen, true).unwrap();
  const displayRanks = flipped ? [...ranks].reverse() : ranks;
  const displayFiles = flipped ? [...files].reverse() : files;
  const squares = displayRanks.flatMap((rank, row) =>
    displayFiles.map((file, column) => ({
      column,
      row,
      square: parseCoordinates(file, rank) as Square,
    })),
  );
  const lastMoveRecord = state.moves.at(-1);
  const lastMove = lastMoveRecord ? parseUsi(lastMoveRecord.usi) : undefined;
  const lastOrigin = lastMove && "from" in lastMove ? lastMove.from : undefined;
  const lastDestination = lastMove?.to;
  const lastMoveSide = pos.turn === "sente" ? "△" : "▲";
  const lastMoveText = lastMoveRecord
    ? `${lastMoveSide}${lastMoveRecord.kif
        .replace(/^[▲△]/, "")
        .replace(/\(\d+\)$/, "")}`
    : "なし";

  return (
    <div className="play-area">
      <HandPieces
        color={flipped ? "sente" : "gote"}
        dispatch={dispatch}
        enabled={enabled}
        game={state}
      />
      <div className="board-shell" aria-label="対局用将棋盤">
        <div className="board" role="grid" aria-rowcount={9} aria-colcount={9}>
          {squares.map(({ column, row, square }) => {
            const piece = pos.board.get(square);
            const selected =
              state.selection?.kind === "board" &&
              state.selection.square === square;
            const legal = state.legalDestinations.includes(square);
            const squareName = makeSquareName(square);
            return (
              <button
                aria-label={`${squareName}${piece ? ` ${sideLabels[piece.color]}${pieceLabels[piece.role] ?? piece.role}` : " 空き"}`}
                aria-selected={selected}
                className="square"
                data-last-origin={lastOrigin === square || undefined}
                data-last-destination={lastDestination === square || undefined}
                data-legal={legal || undefined}
                data-side={piece?.color ?? "empty"}
                data-square={squareName}
                disabled={!enabled}
                key={square}
                onClick={() => dispatch({ type: "square-selected", square })}
                role="gridcell"
                type="button"
              >
                {row === 0 && (
                  <span className="board-coordinate board-coordinate-file">
                    {squareName[0]}
                  </span>
                )}
                {column === 8 && (
                  <span className="board-coordinate board-coordinate-rank">
                    {rankLabels[squareName.slice(1)]}
                  </span>
                )}
                {piece && (
                  <span className="piece">
                    {pieceLabels[piece.role] ?? "?"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <HandPieces
        color={flipped ? "gote" : "sente"}
        dispatch={dispatch}
        enabled={enabled}
        game={state}
      />
      <p className="last-move-label" aria-live="polite">
        直前手：<strong>{lastMoveText}</strong>
      </p>
      <p className="game-message" aria-live="polite">
        {enabled ? state.message : "「対局を始める」で盤を操作できます"}
      </p>
      {state.pendingPromotion && (
        <div
          className="promotion-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="成りの選択"
        >
          <strong>成りますか？</strong>
          <div>
            <button
              className="primary-button"
              onClick={() =>
                dispatch({ type: "promotion-resolved", promote: true })
              }
              type="button"
            >
              成る
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                dispatch({ type: "promotion-resolved", promote: false })
              }
              type="button"
            >
              成らない
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
