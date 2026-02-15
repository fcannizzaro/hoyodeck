interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  info?: string;
  onChange: (value: number) => void;
}

export function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  info,
  onChange,
}: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-sd-secondary uppercase tracking-wider">
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        className="w-full px-2.5 py-2 bg-sd-input border border-sd-border rounded text-sd-text text-xs outline-none transition-colors focus:border-sd-focus"
      />
      {info && <p className="text-[11px] text-sd-secondary mt-1">{info}</p>}
    </div>
  );
}
