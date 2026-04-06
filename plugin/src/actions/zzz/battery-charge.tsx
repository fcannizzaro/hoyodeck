import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { ZZZActionSettings } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { StaminaKey } from "@/components/stamina-key";

const GAME = "zzz" as const;
const MAX_BATTERY = GAMES.zzz.staminaMax;
const BASE_DATA_URI = readLocalImageAsDataUri("imgs/actions/zzz/battery-recharge-state@2x.png");
const BATTERY_DATA_URI = readLocalImageAsDataUri("imgs/actions/zzz/battery-recharge.png");

function BatteryChargeKey() {
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("zzz:daily-note");

  useKeyDown(() => {
    void requestUpdate();
  });

  if (account.status !== "resolved") {
    return <PlaceholderKey game={GAME} status={account.status} />;
  }

  const dailyNote = dailyNoteEntry?.status === "ok" ? dailyNoteEntry.data : null;

  if (!dailyNote) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={BASE_DATA_URI} width={144} height={144} />
      </div>
    );
  }

  return (
    <StaminaKey
      baseImage={BASE_DATA_URI}
      iconImage={BATTERY_DATA_URI}
      current={dailyNote.energy.progress.current}
      max={MAX_BATTERY}
      iconSize={115}
      iconOffset={14}
    />
  );
}

export const batteryChargeAction = defineAction<ZZZActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.zzz.battery-charge",
  key: BatteryChargeKey,
  wrapper: createActionWrapper(GAME, ["zzz:daily-note"]),
  info: {
    name: "[ZZZ] Battery Charge",
    icon: "imgs/actions/zzz/battery-recharge-icon",
    tooltip: "Display and refresh Battery Charge",
    states: [{ image: "imgs/actions/zzz/battery-recharge-state", titleAlignment: "middle" }],
  },
});
