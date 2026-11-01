import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGlobalSettings, useSettings, useWillAppear } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings, RedeemCodeSettings } from "@hoyodeck/shared/types";
import { dataController } from "@/services/data-controller";
import { codesClient } from "@/api/manager/client";

interface CodesContextValue {
  codes: string[];
  refreshCodes: () => Promise<string[]>;
}

const CodesContext = createContext<CodesContextValue | null>(null);

/** Public codes do not require a HoYoLAB account or redemption cookies. */
export function CodesProvider({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<RedeemCodeSettings & JsonObject>();
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const game = settings.game ?? "gi";
  const { data: allCodes = [], refetch } = useQuery({
    queryKey: ["codes", "list", game],
    queryFn: () => codesClient.listCodes(game),
    refetchInterval: 30 * 60 * 1000,
  });

  useWillAppear(() => {
    void refetch();
  });

  const codes = allCodes.filter((code) => !globalSettings.redeemedCodes?.[game]?.includes(code));
  const refreshCodes = async () => {
    const available = (await refetch()).data ?? [];
    const redeemed = dataController.getCachedGlobalSettings()?.redeemedCodes?.[game] ?? [];
    return available.filter((code) => !redeemed.includes(code));
  };

  return <CodesContext.Provider value={{ codes, refreshCodes }}>{children}</CodesContext.Provider>;
}

export function useRedeemCodes(): CodesContextValue {
  const ctx = useContext(CodesContext);
  if (!ctx) throw new Error("useRedeemCodes must be used within a CodesProvider");
  return ctx;
}
