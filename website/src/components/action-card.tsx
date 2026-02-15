import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionDef } from "@/data/actions";

interface ActionCardProps {
  action: ActionDef;
  gameId: "genshin" | "hsr" | "zzz";
  index: number;
}

const gradientClass: Record<string, string> = {
  genshin: "gradient-genshin",
  hsr: "gradient-hsr",
  zzz: "gradient-zzz",
};

export function ActionCard({ action, gameId, index }: ActionCardProps) {
  return (
    <Card
      data-animate="fade-up"
      style={{ "--stagger-delay": `${index * 0.1}s` } as React.CSSProperties}
      className={`flex flex-row border-white/5 backdrop-blur-sm transition-colors hover:border-white/10 ${gradientClass[gameId]}`}
    >
      <CardHeader className="flex w-full flex-row items-center gap-4">
        {/* Small Stream Deck button icon */}
        <div className="flex size-[72px] shrink-0 items-center justify-center rounded-lg border border-muted-foreground/20 bg-muted/30">
          <span className="text-[10px] text-muted-foreground">icon</span>
        </div>
        <CardTitle className="text-lg">{action.name}</CardTitle>
      </CardHeader>
    </Card>
  );
}
