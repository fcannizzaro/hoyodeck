interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-sd-button border border-sd-border rounded text-sd-text text-xs cursor-pointer transition-colors hover:bg-sd-button-hover active:bg-sd-input"
    >
      {children}
    </button>
  );
}
