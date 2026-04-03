interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  info?: string;
  onChange: (value: string) => void;
}

export function Select({ label, value, options, info, onChange }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-sd-secondary uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-2 bg-sd-input border border-sd-border rounded text-sd-text text-xs outline-none transition-colors focus:border-sd-focus"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {info && <p className="text-[11px] text-sd-secondary mt-1">{info}</p>}
    </div>
  );
}
