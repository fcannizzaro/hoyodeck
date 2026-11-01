import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSettings, useWillAppear } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { RedeemCodeSettings } from "@hoyodeck/shared/types";
import { codesClient } from "@/api/manager/client";

interface CodesContextValue {
  codes: string[];
  refreshCodes: () => Promise<string[]>;
}

const CodesContext = createContext<CodesContextValue | null>(null);

/** Public codes do not require a HoYoLAB account or redemption cookies. */
export function CodesProvider({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const game = settings.game ?? "gi";
  const { data: codes = [], refetch } = useQuery({
    queryKey: ["codes", "list", game],
    queryFn: () => codesClient.listCodes(game),
    refetchInterval: 30 * 60 * 1000,
  });

  useWillAppear(() => {
    void refetch();
  });

  const refreshCodes = async () => (await refetch()).data ?? [];

  return <CodesContext.Provider value={{ codes, refreshCodes }}>{children}</CodesContext.Provider>;
}

export function useRedeemCodes(): CodesContextValue {
  const ctx = useContext(CodesContext);
  if (!ctx) throw new Error("useRedeemCodes must be used within a CodesProvider");
  return ctx;
}
