import { useState, useEffect } from "react";
import {
  cn,
  defineAction,
  useKeyDown,
  useGlobalSettings,
  useInterval,
} from "@fcannizzaro/streamdeck-react";
import type { JsonObject } from "@elgato/utils";
import type { GenshinActionSettings, GlobalSettings } from "@hoyodeck/shared/types";
import { useGameData } from "@/hooks/use-game-data";
import { createActionWrapper } from "@/contexts/create-action-wrapper";
import { fetchImageAsDataUri } from "@/utils/image";
import { useLocalImageDataUri } from "@/hooks/use-local-image-data-uri";
import { PlaceholderKey } from "@/components/placeholder-key";
import { Badge } from "@/components/badge";

const GAME = "gi" as const;
const COUNTDOWN_INTERVAL_MS = 30_000;

const AVATAR_SIZE = 48;
interface ExpeditionData {
  avatarDataUri: string;
  finished: boolean;
  remainingSeconds: number;
}

function ExpeditionKey() {
  const background = useLocalImageDataUri("imgs/actions/gi/expeditions-state.png");
  const [globalSettings] = useGlobalSettings<GlobalSettings & JsonObject>();
  const { account, data: dailyNoteEntry, requestUpdate } = useGameData("gi:daily-note");
  const animationsDisabled = globalSettings.disableAnimations ?? false;

  const [expeditions, setExpeditions] = useState<ExpeditionData[]>([]);
  const [totalExpeditions, setTotalExpeditions] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [, setTick] = useState(0);

  // Re-render every 30s to update countdown
  useInterval(() => setTick((t) => t + 1), animationsDisabled ? null : COUNTDOWN_INTERVAL_MS);

  useKeyDown(() => {
    void requestUpdate();
  });

  const dailyNote = dailyNoteEntry?.status === "ok" ? dailyNoteEntry.data : null;

  // Fetch avatar images when daily note updates
  useEffect(() => {
    if (!dailyNote) return;

    let cancelled = false;

    Promise.all(dailyNote.expeditions.map((exp) => fetchImageAsDataUri(exp.avatar_side_icon))).then(
      (avatarDataUris) => {
        if (cancelled) return;
        setLastRefreshTime(Date.now());
        setTotalExpeditions(dailyNote.current_expedition_num);
        setExpeditions(
          dailyNote.expeditions.map((exp, i) => ({
            avatarDataUri: avatarDataUris[i]!,
            finished: exp.status === "Finished",
            remainingSeconds: parseInt(exp.remained_time, 10) || 0,
          })),
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [dailyNote]);

  if (account.status !== "resolved") {
    return <PlaceholderKey game={GAME} status={account.status} />;
  }

  if (expeditions.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <img src={background} width={144} height={144} />
      </div>
    );
  }

  // Compute current remaining times
  const elapsed = (Date.now() - lastRefreshTime) / 1000;
  const circles = expeditions.slice(0, 5).map((exp) => {
    const remaining = Math.max(0, exp.remainingSeconds - elapsed);
    return { ...exp, remainingSeconds: remaining, finished: exp.finished || remaining <= 0 };
  });

  const finishedCount = circles.filter((c) => c.finished).length;
  const count = circles.length;

  // Layout: 1-3 = single row, 4-5 = two rows
  const useTwoRows = count > 3;
  const avatarSize = useTwoRows ? AVATAR_SIZE - 8 : AVATAR_SIZE;

  const row1Count = useTwoRows ? Math.ceil(count / 2) : count;
  const row2Count = useTwoRows ? count - row1Count : 0;

  return (
    <div className="relative w-full h-full">
      <img src={background} width={144} height={144} />

      {/* Row 1 */}
      <div
        className="absolute left-0 w-36 gap-1.5 flex items-center justify-center"
        style={{ top: useTwoRows ? 16 : 30 }}
      >
        {circles.slice(0, row1Count).map((exp, i) => (
          <div
            key={i}
            className={cn(
              "overflow-hidden border-2 border-solid border-[#6B4226]",
              exp.finished ? "opacity-100" : "opacity-60",
            )}
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            }}
          >
            <img src={exp.avatarDataUri} width={avatarSize} height={avatarSize} />
          </div>
        ))}
      </div>

      {/* Row 2 (if needed) */}
      {useTwoRows && row2Count > 0 && (
        <div className="absolute top-16 left-0 w-36 gap-1.5 flex items-center justify-center">
          {circles.slice(row1Count).map((exp, i) => (
            <div
              key={i}
              className={cn(
                "overflow-hidden border-2 border-solid border-[#6B4226]",
                exp.finished ? "opacity-100" : "opacity-60",
              )}
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              }}
            >
              <img src={exp.avatarDataUri} width={avatarSize} height={avatarSize} />
            </div>
          ))}
        </div>
      )}

      <Badge text={`${finishedCount} / ${totalExpeditions}`} />
    </div>
  );
}

export const expeditionAction = defineAction<GenshinActionSettings & JsonObject>({
  uuid: "com.fcannizzaro.hoyodeck.genshin.expedition",
  key: ExpeditionKey,
  wrapper: createActionWrapper(GAME, ["gi:daily-note"]),
  info: {
    name: "[GI] Expeditions",
    icon: "imgs/actions/gi/expeditions-icon",
    tooltip: "Display completed expeditions",
    states: [{ image: "imgs/actions/gi/expeditions-state", titleAlignment: "middle" }],
  },
});
