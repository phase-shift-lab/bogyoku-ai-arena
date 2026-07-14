import {
  strategyOption,
  surpriseStrategyOptions,
  type StrategyId,
  type StrategySelectionMode,
} from "../strategy/openings/catalog";

interface StrategyPickerProps {
  readonly label: string;
  readonly mode: StrategySelectionMode;
  readonly value: StrategyId;
  readonly resolvedValue?: StrategyId | null;
  readonly disabled?: boolean;
  readonly onChange: (value: StrategyId) => void;
  readonly onModeChange: (value: StrategySelectionMode) => void;
}

const selectionModes: readonly {
  id: StrategySelectionMode;
  label: string;
}[] = [
  { id: "normal", label: "通常" },
  { id: "specified", label: "奇襲指定" },
  { id: "auto", label: "奇襲おまかせ" },
];

export function StrategyPicker({
  label,
  mode,
  value,
  resolvedValue,
  disabled = false,
  onChange,
  onModeChange,
}: StrategyPickerProps) {
  const resolved = resolvedValue ? strategyOption(resolvedValue) : undefined;

  return (
    <fieldset className="strategy-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div
        aria-label="戦法選択モード"
        className="strategy-mode-switch"
        role="group"
      >
        {selectionModes.map((selectionMode) => (
          <button
            aria-pressed={mode === selectionMode.id}
            className="strategy-mode-button"
            key={selectionMode.id}
            onClick={() => onModeChange(selectionMode.id)}
            type="button"
          >
            {selectionMode.label}
          </button>
        ))}
      </div>

      {mode === "specified" ? (
        <div className="strategy-card-list" role="group" aria-label={label}>
          {surpriseStrategyOptions.map((option) => (
            <button
              aria-pressed={value === option.id}
              className="strategy-card"
              data-category={option.category}
              key={option.id}
              onClick={() => onChange(option.id)}
              type="button"
            >
              <small>{option.category}</small>
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="strategy-mode-note" aria-live="polite">
          {mode === "normal"
            ? "評価値を優先して指します"
            : resolved
              ? `今回の奇襲：${resolved.label}`
              : "対局開始時に奇襲戦法を1つ選びます"}
        </p>
      )}
    </fieldset>
  );
}
