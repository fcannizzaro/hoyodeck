interface ButtonProps {
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

export function Button({ children, onClick, disabled }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-sd-button border border-sd-border rounded text-sd-text text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-sd-button-hover active:bg-sd-input"
    >
      {children}
    </button>
  );
}
