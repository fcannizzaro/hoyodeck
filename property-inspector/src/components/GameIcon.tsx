import { GAME_ICONS, type GameId } from '../constants/games';

interface GameIconProps {
  game: GameId;
  size?: number;
  className?: string;
}

/**
 * Renders a small game icon image for the given game.
 */
export function GameIcon({ game, size = 14, className }: GameIconProps) {
  return (
    <img
      src={GAME_ICONS[game]}
      alt={game}
      width={size}
      height={size}
      className={`shrink-0 ${className ?? ''}`}
    />
  );
}
