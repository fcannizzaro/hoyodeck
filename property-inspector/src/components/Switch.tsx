interface SwitchProps {
  label: string;
  checked: boolean;
  info?: string;
  onChange: (checked: boolean) => void;
}

/**
 * shadcn-style toggle switch — sized for the Stream Deck property inspector.
 */
export function Switch({ label, checked, info, onChange }: SwitchProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span>{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`
            relative inline-flex h-5 w-9 shrink-0 items-center rounded-full
            border-2 border-transparent transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sd-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sd-bg
            ${checked ? "bg-sd-focus" : "bg-sd-input"}
          `}
        >
          <span
            className={`
              pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg
              transition-transform
              ${checked ? "translate-x-4" : "translate-x-0"}
            `}
          />
        </button>
      </label>
      {info && <p className="text-[11px] text-sd-secondary mt-1">{info}</p>}
    </div>
  );
}
