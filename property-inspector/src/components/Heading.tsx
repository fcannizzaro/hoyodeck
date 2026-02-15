export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold mb-2 pb-2 border-b border-sd-border">
      {children}
    </h2>
  );
}
