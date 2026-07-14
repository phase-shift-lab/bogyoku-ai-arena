import { parseSfen } from "shogiops/sfen";
import { parseUsi } from "shogiops/util";

export type StrategySelectionMode = "normal" | "specified" | "auto";

export type StrategyId =
  | "bogyoku"
  | "oni-koroshi"
  | "new-oni-koroshi"
  | "haya-ishida"
  | "suji-chigai-kaku"
  | "pacman"
  | "ureshino"
  | "edge-bishop-nakabisha"
  | "bishop-head-pawn"
  | "kintoun"
  | "ponpon-kei"
  | "duck"
  | "kusarigama-silver"
  | "first-file-rook"
  | "primitive-climbing-silver"
  | "normal";

export type SurpriseStrategyId = Exclude<StrategyId, "normal">;

export interface StrategyOption {
  readonly id: StrategyId;
  readonly category: "看板" | "定番奇襲" | "マイナー" | "通常";
  readonly label: string;
  readonly detail: string;
}

export const strategyOptions: readonly StrategyOption[] = [
  {
    id: "bogyoku",
    category: "看板",
    label: "棒玉",
    detail: "玉を飛車先へ進める",
  },
  {
    id: "oni-koroshi",
    category: "定番奇襲",
    label: "鬼殺し",
    detail: "桂を跳ねて急襲",
  },
  {
    id: "new-oni-koroshi",
    category: "定番奇襲",
    label: "新鬼殺し",
    detail: "守りを添えて桂を跳ねる",
  },
  {
    id: "haya-ishida",
    category: "定番奇襲",
    label: "早石田",
    detail: "三間飛車から速攻",
  },
  {
    id: "suji-chigai-kaku",
    category: "定番奇襲",
    label: "筋違い角",
    detail: "角交換から変化",
  },
  {
    id: "pacman",
    category: "定番奇襲",
    label: "パックマン",
    detail: "中央の歩を囮にする",
  },
  {
    id: "ureshino",
    category: "定番奇襲",
    label: "嬉野流",
    detail: "角道を開けず銀を繰り出す",
  },
  {
    id: "edge-bishop-nakabisha",
    category: "定番奇襲",
    label: "端角中飛車",
    detail: "端角と中飛車で攻める",
  },
  {
    id: "bishop-head-pawn",
    category: "マイナー",
    label: "角頭歩",
    detail: "角頭の歩を大胆に進める",
  },
  {
    id: "kintoun",
    category: "マイナー",
    label: "きんとうん",
    detail: "玉を右辺へ軽く運ぶ",
  },
  {
    id: "ponpon-kei",
    category: "マイナー",
    label: "ポンポン桂",
    detail: "桂を早跳ねして仕掛ける",
  },
  {
    id: "duck",
    category: "マイナー",
    label: "アヒル",
    detail: "低い陣形から反撃する",
  },
  {
    id: "kusarigama-silver",
    category: "マイナー",
    label: "鎖鎌銀",
    detail: "銀を飛車先へ繰り出す",
  },
  {
    id: "first-file-rook",
    category: "マイナー",
    label: "一間飛車",
    detail: "飛車を端へ振る",
  },
  {
    id: "primitive-climbing-silver",
    category: "マイナー",
    label: "原始棒銀",
    detail: "飛車先へ銀を一直線に進める",
  },
  { id: "normal", category: "通常", label: "通常", detail: "評価値を最優先" },
] as const;

export const surpriseStrategyOptions = strategyOptions.filter(
  (option): option is StrategyOption & { readonly id: SurpriseStrategyId } =>
    option.id !== "normal",
);

const senteLines: Readonly<
  Partial<Record<StrategyId, readonly (readonly string[])[]>>
> = {
  "oni-koroshi": [["7g7f", "8i7g", "7g6e"]],
  "new-oni-koroshi": [
    ["7g7f", "8i7g", "6i5h", "7g6e"],
    ["7g7f", "6i5h", "8i7g", "7g6e"],
  ],
  "haya-ishida": [
    ["7g7f", "2h7h", "7f7e"],
    ["7g7f", "7f7e", "2h7h"],
  ],
  "suji-chigai-kaku": [["7g7f", "8h2b+", "B*4e"]],
  pacman: [["6g6f"]],
  ureshino: [["7i6h", "6h7g", "8h7i", "2g2f"]],
  "edge-bishop-nakabisha": [["9g9f", "8h9g", "2h5h", "5g5f"]],
  "bishop-head-pawn": [["8g8f", "8f8e"]],
  kintoun: [["5i6h", "6h7h", "7h8h"]],
  "ponpon-kei": [["7g7f", "2g2f", "3g3f", "2i3g", "3g4e"]],
  duck: [["5i5h", "6i6h", "4i4h", "7i7h", "3i3h"]],
  "kusarigama-silver": [["2g2f", "3i3h", "3h2g", "2g3f", "3f4e"]],
  "first-file-rook": [["2h1h", "1g1f"]],
  "primitive-climbing-silver": [["2g2f", "3i3h", "2f2e", "3h2g", "2g2f"]],
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

export function strategyOption(strategy: StrategyId) {
  return strategyOptions.find((option) => option.id === strategy);
}

export function chooseRandomSurpriseStrategy(
  intensity: number,
  random: () => number = Math.random,
): SurpriseStrategyId {
  const normalized = Math.max(0, Math.min(100, intensity)) / 100;
  const weighted = surpriseStrategyOptions.map((option) => ({
    id: option.id,
    weight:
      option.category === "マイナー"
        ? 0.3 + normalized * 1.4
        : option.category === "看板"
          ? 1.1 + normalized * 0.8
          : 1,
  }));
  const total = weighted.reduce((sum, option) => sum + option.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999999, random())) * total;
  for (const option of weighted) {
    cursor -= option.weight;
    if (cursor < 0) return option.id;
  }
  return weighted.at(-1)?.id ?? "bogyoku";
}

export function openingCandidates(
  strategy: StrategyId,
  sfen: string,
  history: readonly string[],
): readonly string[] {
  const lines = senteLines[strategy];
  if (!lines) return [];
  const position = parseSfen("standard", sfen, true).unwrap();
  const ownHistory = history.filter((_, index) =>
    position.turn === "sente" ? index % 2 === 0 : index % 2 === 1,
  );
  const candidates = new Set<string>();

  for (const line of lines) {
    const sideLine = position.turn === "sente" ? line : line.map(mirrorUsi);
    const followsLine = ownHistory.every(
      (move, index) => move === sideLine[index],
    );
    if (!followsLine) continue;
    const candidate = sideLine[ownHistory.length];
    if (!candidate) continue;
    const move = parseUsi(candidate);
    if (move && position.isLegal(move)) candidates.add(candidate);
  }

  return [...candidates];
}
