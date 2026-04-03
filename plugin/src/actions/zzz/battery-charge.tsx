import { defineAction, useKeyDown } from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { ZZZActionSettings } from "@/types/settings";
import { GAMES } from "@/types/games";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { readLocalImageAsDataUri } from "@/utils/image";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

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

  const current = dailyNote.energy.progress.current;
  const percentage = Math.min(Math.max(current / MAX_BATTERY, 0), 1);
  const coverH = Math.round(144 * (1 - percentage));

  return (
    <div className="relative w-full h-full">
      <img src={BASE_DATA_URI} width={144} height={144} />
      <div className="absolute" style={{ top: 14, left: 14, width: 115, height: 115 }}>
        <img src={BATTERY_DATA_URI} width={115} height={115} />
      </div>
      <div
        className="absolute"
        style={{
          top: 0,
          left: 0,
          width: 144,
          height: coverH,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
        }}
      />
      <Badge text={`${current}`} />
    </div>
  );
}

export const batteryChargeAction = defineAction<ZZZActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.zzz.battery-charge",
  key: BatteryChargeKey,
  wrapper: createActionWrapper(GAME, ["zzz:daily-note"]),
});
