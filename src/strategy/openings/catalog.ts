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
export type GuidedStrategyId = Exclude<SurpriseStrategyId, "bogyoku">;

export interface OpeningGuide {
  readonly idealForm: string;
  readonly lines: readonly (readonly string[])[];
}

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

export const openingGuides: Readonly<Record<GuidedStrategyId, OpeningGuide>> = {
  "oni-koroshi": {
    idealForm: "桂を6五へ跳ね、7筋へ飛車を回して速攻する形",
    lines: [["7g7f", "8i7g", "7g6e", "2h7h", "7h7f"]],
  },
  "new-oni-koroshi": {
    idealForm: "金を5八へ添え、桂を6五へ跳ねて7筋から攻める形",
    lines: [
      ["7g7f", "8i7g", "6i5h", "7g6e", "2h7h"],
      ["7g7f", "6i5h", "8i7g", "7g6e", "2h7h"],
    ],
  },
  "haya-ishida": {
    idealForm: "7五歩・7八飛を急ぎ、玉を4八へ寄せて三間飛車で速攻する形",
    lines: [
      ["7g7f", "7f7e", "2h7h", "5i4h", "7h7f"],
      ["7g7f", "2h7h", "7f7e", "5i4h", "7h7f"],
    ],
  },
  "suji-chigai-kaku": {
    idealForm: "角交換後に4五へ角を打ち、歩得と両取りを狙う形",
    lines: [["7g7f", "8h2b+", "B*4e"]],
  },
  pacman: {
    idealForm: "中央の歩を囮にし、相手の取り込みへ飛車で反撃する形",
    lines: [["6g6f", "2h6h", "6h6f"]],
  },
  ureshino: {
    idealForm: "角道を閉じたまま銀を7七・6六へ進め、引き角と飛車先で攻める形",
    lines: [["7i6h", "6h7g", "8h7i", "7g6f", "2g2f"]],
  },
  "edge-bishop-nakabisha": {
    idealForm: "9七角と5八飛を組み合わせ、中央と遠い対角線を攻める形",
    lines: [
      ["5g5f", "9g9f", "2h5h", "8h9g", "5f5e"],
      ["9g9f", "8h9g", "5g5f", "2h5h", "5f5e"],
    ],
  },
  "bishop-head-pawn": {
    idealForm: "8筋の歩を早く進め、角頭を起点に主導権を奪う形",
    lines: [["8g8f", "8f8e"]],
  },
  kintoun: {
    idealForm: "角を7七へ上げて玉を8八へ運び、右辺の金銀を低く連結する形",
    lines: [["7g7f", "8h7g", "5i6h", "6h7h", "7h8h", "6i7h", "7i6h"]],
  },
  "ponpon-kei": {
    idealForm: "3筋の歩と桂を連動させ、桂を4五へ早跳ねする形",
    lines: [["7g7f", "2g2f", "3g3f", "2i3g", "3g4e"]],
  },
  duck: {
    idealForm: "浮き飛車と端角を構え、玉を中央に置いて金銀を低く連結する形",
    lines: [
      [
        "2g2f",
        "2f2e",
        "2h2f",
        "9g9f",
        "8h9g",
        "5i5h",
        "3i4h",
        "7i6h",
        "6i7i",
        "4i3i",
      ],
    ],
  },
  "kusarigama-silver": {
    idealForm: "銀を飛車先から3六・4五へ繰り出し、鎖鎌のように圧力を掛ける形",
    lines: [["2g2f", "3i3h", "3h2g", "2g3f", "3f4e"]],
  },
  "first-file-rook": {
    idealForm: "1筋の歩を伸ばして飛車を1八へ振り、端へ戦力を集中する形",
    lines: [["1g1f", "2h1h", "1f1e", "3i4h", "4h3g"]],
  },
  "primitive-climbing-silver": {
    idealForm: "飛車先の歩・銀・飛車を一直線に並べ、銀を1五方面へ進める形",
    lines: [["2g2f", "3i3h", "2f2e", "3h2g", "2g2f", "2f1e"]],
  },
};

const MAX_GUIDED_OWN_MOVES = 12;

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
  if (strategy === "normal" || strategy === "bogyoku") return [];
  const guide = openingGuides[strategy];
  const position = parseSfen("standard", sfen, true).unwrap();
  const ownHistory = history.filter((_, index) =>
    position.turn === "sente" ? index % 2 === 0 : index % 2 === 1,
  );
  if (ownHistory.length > MAX_GUIDED_OWN_MOVES) return [];
  const candidates = new Set<string>();

  for (const line of guide.lines) {
    const sideLine = position.turn === "sente" ? line : line.map(mirrorUsi);
    let progress = 0;
    for (const move of ownHistory) {
      if (move === sideLine[progress]) progress += 1;
    }

    for (let index = progress; index < sideLine.length; index += 1) {
      const candidate = sideLine[index];
      if (!candidate) continue;
      const move = parseUsi(candidate);
      if (!move || !position.isLegal(move)) continue;
      candidates.add(candidate);
      break;
    }
  }

  return [...candidates];
}
