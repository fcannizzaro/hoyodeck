import { useEffect } from "react";
import { useGlobalSettings } from "@fcannizzaro/streamdeck-react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings } from "@hoyodeck/shared/types";
import { toJsonObject } from "@/utils/json";
import { queryClient } from "@/services/query-client";
import { dataController } from "@/services/data-controller";

/**
 * Plugin-level wrapper that provides global React contexts to ALL action roots.
 *
 * Renders inside the built-in SettingsProvider / GlobalSettingsProvider tree
 * (see Context Provider Tree in streamdeck-react docs), so any provider here
 * can read settings and global settings via hooks.
 *
 * Responsibilities:
 * - Hosts QueryClientProvider so individual actions don't need to.
 * - Bridges non-React global settings writes (auth-validator, login handler)
 *   through the framework's `useGlobalSettings` setter so all action roots
 *   re-render when services write global settings from outside React.
 */
export function PluginWrapper({ children }: { children?: React.ReactNode }) {
  const [, setGlobalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();

  // Register the framework's setter with the DataController so that
  // non-React code calling dataController.writeGlobalSettings() flows
  // through the hook and propagates to all action roots.
  useEffect(() => {
    return dataController.registerGlobalSettingsWriter((settings) => {
      setGlobalSettings(toJsonObject(settings));
    });
  }, [setGlobalSettings]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
