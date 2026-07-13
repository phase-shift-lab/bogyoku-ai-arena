import { strategyOptions, type StrategyId } from "../strategy/openings/catalog";

interface StrategyPickerProps {
  readonly label: string;
  readonly value: StrategyId;
  readonly onChange: (value: StrategyId) => void;
}

export function StrategyPicker({
  label,
  value,
  onChange,
}: StrategyPickerProps) {
  return (
    <fieldset className="strategy-picker">
      <legend>{label}</legend>
      <div className="strategy-card-list" role="radiogroup" aria-label={label}>
        {strategyOptions.map((option) => (
          <button
            aria-checked={value === option.id}
            className="strategy-card"
            data-category={option.category}
            key={option.id}
            onClick={() => onChange(option.id)}
            role="radio"
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
