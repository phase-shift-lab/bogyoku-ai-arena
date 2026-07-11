import type { PrincipalVariation } from "../engine/usiTypes";

interface VariationTreeProps {
  readonly variations: readonly PrincipalVariation[];
}

function scoreLabel(variation: PrincipalVariation) {
  if (variation.mate !== undefined) return `詰 ${variation.mate}`;
  return `${variation.scoreCp !== undefined && variation.scoreCp > 0 ? "+" : ""}${variation.scoreCp ?? 0} cp`;
}

export function VariationTree({ variations }: VariationTreeProps) {
  if (variations.length === 0) {
    return <p className="empty-analysis">解析結果はまだありません</p>;
  }

  return (
    <div className="variation-tree" aria-label="MultiPV変化ツリー">
      <div className="variation-root">現在局面</div>
      <ol>
        {variations.map((variation) => (
          <li key={variation.multipv}>
            <div className="variation-branch">
              <strong>候補 {variation.multipv}</strong>
              <span>{scoreLabel(variation)}</span>
            </div>
            <ol aria-label={`候補 ${variation.multipv} の読み筋`}>
              {variation.pv.slice(0, 7).map((move, index) => (
                <li key={`${index}-${move}`}>
                  <span>{index + 1}</span>
                  <code>{move}</code>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
