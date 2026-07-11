import { useState } from "react";

import type { ShogiGameAction, ShogiGameState } from "../game/shogiGame";
import { exportKif } from "../game/shogiGame";

interface Props {
  readonly state: ShogiGameState;
  readonly dispatch: (action: ShogiGameAction) => void;
}

export function RecordTools({ state, dispatch }: Props) {
  const [sfenImport, setSfenImport] = useState("");
  const [kifImport, setKifImport] = useState("");
  const saveKif = () => {
    const url = URL.createObjectURL(
      new Blob([exportKif(state)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `bogyoku-${new Date().toISOString().slice(0, 10)}.kif`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="record-tools">
      <summary>SFEN / KIF 入出力</summary>
      <label>
        <span>現在のSFEN（出力）</span>
        <textarea readOnly value={state.sfen} rows={3} />
      </label>
      <label>
        <span>SFEN読込</span>
        <textarea
          placeholder="SFENを貼り付け"
          value={sfenImport}
          onChange={(event) => setSfenImport(event.target.value)}
          rows={3}
        />
      </label>
      <button
        className="secondary-button"
        onClick={() => dispatch({ type: "sfen-imported", sfen: sfenImport })}
        type="button"
      >
        SFENを読み込む
      </button>
      <label>
        <span>現在のKIF（出力）</span>
        <textarea readOnly value={exportKif(state)} rows={8} />
      </label>
      <label>
        <span>KIF読込</span>
        <textarea
          placeholder="KIFを貼り付け"
          value={kifImport}
          onChange={(event) => setKifImport(event.target.value)}
          rows={8}
        />
      </label>
      <button className="secondary-button" onClick={saveKif} type="button">
        KIFを保存
      </button>
      <button
        className="secondary-button"
        onClick={() => dispatch({ type: "kif-imported", kif: kifImport })}
        type="button"
      >
        KIFを読み込む
      </button>
    </details>
  );
}
