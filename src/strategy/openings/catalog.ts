import { parseSfen } from "shogiops/sfen";
import { parseUsi } from "shogiops/util";

export type StrategyId =
  | "bogyoku"
  | "oni-koroshi"
  | "haya-ishida"
  | "suji-chigai-kaku"
  | "edge-bishop-nakabisha"
  | "normal";

export interface StrategyOption {
  readonly id: StrategyId;
  readonly category: "棒玉" | "奇襲" | "通常";
  readonly label: string;
  readonly detail: string;
}

export const strategyOptions: readonly StrategyOption[] = [
  {
    id: "bogyoku",
    category: "棒玉",
    label: "棒玉",
    detail: "玉を飛車先へ進める",
  },
  {
    id: "oni-koroshi",
    category: "奇襲",
    label: "鬼殺し",
    detail: "桂を跳ねて急襲",
  },
  {
    id: "haya-ishida",
    category: "奇襲",
    label: "早石田",
    detail: "三間飛車から速攻",
  },
  {
    id: "suji-chigai-kaku",
    category: "奇襲",
    label: "筋違い角",
    detail: "角交換から変化",
  },
  {
    id: "edge-bishop-nakabisha",
    category: "奇襲",
    label: "端角中飛車",
    detail: "端角と中飛車で攻める",
  },
  { id: "normal", category: "通常", label: "通常", detail: "評価値を最優先" },
] as const;

const senteSequences: Readonly<Partial<Record<StrategyId, readonly string[]>>> =
  {
    "oni-koroshi": ["7g7f", "8i7g", "7g6e"],
    "haya-ishida": ["7g7f", "2h7h", "7f7e"],
    "suji-chigai-kaku": ["7g7f", "8h2b+", "B*4e"],
    "edge-bishop-nakabisha": ["9g9f", "8h9g", "2h5h", "5g5f"],
  };

function mirrorUsi(usi: string) {
  return usi.replace(/[1-9][a-i]/g, (square) => {
    const file = 10 - Number(square[0]);
    const rank = String.fromCharCode(
      "a".charCodeAt(0) + ("i".charCodeAt(0) - square.charCodeAt(1)),
    );
    return `${file}${rank}`;
  });
}

export function openingCandidates(
  strategy: StrategyId,
  sfen: string,
  history: readonly string[],
): readonly string[] {
  const sequence = senteSequences[strategy];
  if (!sequence) return [];
  const position = parseSfen("standard", sfen, true).unwrap();
  const sideSequence =
    position.turn === "sente" ? sequence : sequence.map(mirrorUsi);
  const ownHistory = history.filter((_, index) =>
    position.turn === "sente" ? index % 2 === 0 : index % 2 === 1,
  );
  const nextIndex = ownHistory.findIndex(
    (move, index) => move !== sideSequence[index],
  );
  const resolvedIndex = nextIndex === -1 ? ownHistory.length : nextIndex;
  if (resolvedIndex !== ownHistory.length) return [];
  const candidate = sideSequence[resolvedIndex];
  if (!candidate) return [];
  const move = parseUsi(candidate);
  return move && position.isLegal(move) ? [candidate] : [];
}
