import {
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
  const activeStrategy =
    mode === "specified" ? value : mode === "auto" ? resolvedValue : null;

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

      <div className="strategy-card-list" role="group" aria-label={label}>
        {surpriseStrategyOptions.map((option) => (
          <button
            aria-pressed={activeStrategy === option.id}
            className="strategy-card"
            data-category={option.category}
            data-strategy-id={option.id}
            key={option.id}
            onClick={() => {
              if (mode !== "specified") onModeChange("specified");
              onChange(option.id);
            }}
            type="button"
          >
            <small>{option.category}</small>
            <strong>{option.label}</strong>
            <span>{option.detail}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
