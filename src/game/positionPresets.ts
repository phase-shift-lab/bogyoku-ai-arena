import { initialSfen } from "shogiops/sfen";

export type PositionPresetId = "flat" | "two-piece" | "four-piece";

export interface PositionPreset {
  readonly id: PositionPresetId;
  readonly label: string;
  readonly sfen: string;
}

export const positionPresets: readonly PositionPreset[] = [
  {
    id: "flat",
    label: "平手",
    sfen: initialSfen("standard"),
  },
  {
    id: "two-piece",
    label: "二枚落ち（後手の飛・角なし）",
    sfen: "lnsgkgsnl/9/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1",
  },
  {
    id: "four-piece",
    label: "四枚落ち（後手の飛・角・香なし）",
    sfen: "1nsgkgsn1/9/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1",
  },
];

export function positionPresetById(id: PositionPresetId) {
  return (
    positionPresets.find((preset) => preset.id === id) ?? positionPresets[0]!
  );
}

export function positionPresetIdForSfen(sfen: string): PositionPresetId {
  return positionPresets.find((preset) => preset.sfen === sfen)?.id ?? "flat";
}
