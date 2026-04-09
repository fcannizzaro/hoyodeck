import { defineAction, useKeyDown, useSettings } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { StaminaSettings, GameId } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import type { GenshinDailyNote } from "@/api/types/genshin";
import type { StarRailDailyNote } from "@/api/types/hsr";
import type { ZZZDailyNote } from "@/api/types/zzz";
import { useGameData } from "@/hooks/use-game-data";
import { AccountProvider } from "@/contexts/account-context";
import { DataProvider } from "@/contexts/data-context";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { PlaceholderKey } from "@/components/placeholder-key";
import { StaminaKey } from "@/components/stamina-key";
import type { DataType } from "@/services/data-controller.types";

// ─── Per-game config ──────────────────────────────────────────────

interface StaminaGameConfig {
  baseImage: string;
  iconImage: string;
  staminaMax: number;
  dataType: DataType;
  extractCurrent: (dailyNote: unknown) => number;
  iconSize?: number;
  iconOffset?: number;
}

const GAME_CONFIGS: Record<GameId, StaminaGameConfig> = {
  gi: {
    baseImage: "imgs/actions/gi/3-star.png",
    iconImage: "imgs/actions/gi/resin.webp",
    staminaMax: GAMES.gi.staminaMax,
    dataType: "gi:daily-note",
    extractCurrent: (note) => (note as GenshinDailyNote).current_resin,
  },
  hsr: {
    baseImage: "imgs/actions/hsr/trailblaze-power-state@2x.png",
    iconImage: "imgs/actions/hsr/trailblaze-power.webp",
    staminaMax: GAMES.hsr.staminaMax,
    dataType: "hsr:daily-note",
    extractCurrent: (note) => (note as StarRailDailyNote).current_stamina,
  },
  zzz: {
    baseImage: "imgs/actions/zzz/battery-recharge-state@2x.png",
    iconImage: "imgs/actions/zzz/battery-recharge.png",
    staminaMax: GAMES.zzz.staminaMax,
    dataType: "zzz:daily-note",
    extractCurrent: (note) => (note as ZZZDailyNote).energy.progress.current,
    iconSize: 115,
    iconOffset: 14,
  },
};

// ─── Key Component ────────────────────────────────────────────────

function UnifiedStaminaKey() {
  const [settings] = useSettings<StaminaSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;
  const config = GAME_CONFIGS[game];

  const baseDataUri = useLocalImageDataUri(config.baseImage);
  const iconDataUri = useLocalImageDataUri(config.iconImage);
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData(config.dataType);

  useKeyDown(() => {
    void requestUpdate();
  });

  if (account.status !== "resolved") {
    return <PlaceholderKey game={game} status={account.status} />;
  }

  const dailyNote = dailyNoteEntry?.status === "ok" ? dailyNoteEntry.data : null;

  if (!dailyNote) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={baseDataUri} width={144} height={144} />
      </div>
    );
  }

  return (
    <StaminaKey
      baseImage={baseDataUri}
      iconImage={iconDataUri}
      current={config.extractCurrent(dailyNote)}
      max={config.staminaMax}
      iconSize={config.iconSize}
      iconOffset={config.iconOffset}
    />
  );
}

// ─── Custom Wrapper (dynamic game from settings) ──────────────────

function StaminaWrapper({ children }: { children?: React.ReactNode }) {
  const [settings] = useSettings<StaminaSettings & JsonObject>();
  const game = (settings.game ?? "gi") as GameId;
  const dataType = GAME_CONFIGS[game].dataType;

  return (
    <AccountProvider game={game}>
      <DataProvider game={game} dataTypes={[dataType]}>
        {children}
      </DataProvider>
    </AccountProvider>
  );
}

// ─── Action Definition ────────────────────────────────────────────

export const staminaAction = defineAction<StaminaSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.stamina",
  key: UnifiedStaminaKey,
  wrapper: StaminaWrapper,
  info: {
    name: "Stamina",
    icon: "imgs/actions/common/stamina-icon",
    tooltip: "Display and refresh game stamina (Resin, Trailblaze Power, Battery)",
    states: [{ image: "imgs/actions/gi/3-star", titleAlignment: "middle" }],
  },
});
