interface TextAreaProps {
  label: string;
  value: string;
  placeholder?: string;
  info?: string;
  onChange: (value: string) => void;
}

export function TextArea({
  label,
  value,
  placeholder,
  info,
  onChange,
}: TextAreaProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-sd-secondary uppercase tracking-wider">
        {label}
      </label>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-2 bg-sd-input border border-sd-border rounded text-sd-text text-[11px] font-mono outline-none transition-colors focus:border-sd-focus min-h-[80px] resize-y"
      />
      {info && <p className="text-[11px] text-sd-secondary mt-1">{info}</p>}
    </div>
  );
}
