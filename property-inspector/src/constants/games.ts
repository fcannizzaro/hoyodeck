import type { GameId } from "@hoyodeck/shared/types";
import genshinIcon from "../assets/games/gi.png";
import hsrIcon from "../assets/games/hsr.png";
import zzzIcon from "../assets/games/zzz.png";

export type { GameId } from "@hoyodeck/shared/types";

export const GAME_ICONS: Record<GameId, string> = {
  gi: genshinIcon,
  hsr: hsrIcon,
  zzz: zzzIcon,
};
