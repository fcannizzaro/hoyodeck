interface CheckboxProps {
  label: string;
  checked: boolean;
  info?: string;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ label, checked, info, onChange }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-sd-focus"
        />
        <span>{label}</span>
      </label>
      {info && <p className="text-[11px] text-sd-secondary mt-1">{info}</p>}
    </div>
  );
}
