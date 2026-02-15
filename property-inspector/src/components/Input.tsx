import type { ReactNode } from 'react';

interface InputProps {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  info?: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function Input({
  label,
  value,
  placeholder,
  maxLength,
  info,
  icon,
  onChange,
  onBlur,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sd-secondary uppercase tracking-wider">
        {icon}
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full px-2.5 py-2 bg-sd-input border border-sd-border rounded text-sd-text text-xs outline-none transition-colors focus:border-sd-focus"
      />
      {info && <p className="text-[11px] text-sd-secondary mt-1">{info}</p>}
    </div>
  );
}
