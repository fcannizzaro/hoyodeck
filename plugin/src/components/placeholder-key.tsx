import type { AccountContextValue } from "@/contexts/account-context";
import { readLocalImageAsDataUri } from "@/utils/image";
import type { GameId } from "@/types/games";

const GAME_BACKGROUNDS: Record<GameId, string> = {
  gi: "imgs/actions/gi/5-star.png",
  hsr: "imgs/actions/hsr/5-star.png",
  zzz: "imgs/actions/zzz/5-star.png",
};

const STATUS_LABELS: Record<Exclude<AccountContextValue["status"], "resolved">, string> = {
  "no-accounts": "Login",
  "no-uid": "Set\nUID",
  ambiguous: "Select\nAccount",
};

interface PlaceholderKeyProps {
  game: GameId;
  status: Exclude<AccountContextValue["status"], "resolved">;
}

/**
 * Shared placeholder component shown when no account is resolved.
 * Displays the game's 5-star background with an appropriate status message.
 */
export function PlaceholderKey({ game, status }: PlaceholderKeyProps) {
  const bgDataUri = readLocalImageAsDataUri(GAME_BACKGROUNDS[game]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      <img src={bgDataUri} width={144} height={144} />
      <div className="absolute flex items-center justify-center">
        <span
          style={{
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "Inter",
            textAlign: "center",
          }}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
    </div>
  );
}
