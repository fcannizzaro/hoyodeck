export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold pb-2 border-b border-sd-border">
      {children}
    </h2>
  );
}
