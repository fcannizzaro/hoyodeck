import type { HoyolabClient } from "@/api/hoyolab/client";
import type { DataType } from "../data-controller.types";
import { BaseGameController } from "./base-game-controller";

/**
 * Honkai: Star Rail data fetcher.
 * Handles: daily note, memory of chaos, pure fiction, apocalyptic shadow, anomaly arbitration, act calendar, check-in.
 */
export class HSRController extends BaseGameController {
  readonly game = "hsr" as const;

  protected getFetchers(client: HoyolabClient, uid: string): Map<DataType, () => Promise<unknown>> {
    return new Map<DataType, () => Promise<unknown>>([
      ["hsr:daily-note", () => client.getStarRailDailyNote(uid)],
      ["hsr:memory-of-chaos", () => client.getStarRailMemoryOfChaos(uid)],
      ["hsr:pure-fiction", () => client.getStarRailPureFiction(uid)],
      ["hsr:apocalyptic-shadow", () => client.getStarRailApocalypticShadow(uid)],
      ["hsr:anomaly-arbitration", () => client.getStarRailAnomalyArbitration(uid)],
      ["hsr:act-calendar", () => client.getStarRailActCalendar(uid)],
      [
        "hsr:check-in",
        async () => {
          const [info, rewards] = await Promise.all([
            client.getCheckInInfo("hsr", uid),
            client.getCheckInRewards("hsr", uid),
          ]);
          return { info, rewards };
        },
      ],
    ]);
  }
}
