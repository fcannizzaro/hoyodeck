import { Button } from '../components/Button';

type GameId = 'genshin' | 'starrail' | 'zzz';

interface HoyoAccount {
  id: string;
  name: string;
  authStatus: 'unknown' | 'valid' | 'invalid';
  uids: Partial<Record<GameId, string>>;
}

const GAME_LABELS: Record<GameId, string> = {
  genshin: 'GI',
  starrail: 'HSR',
  zzz: 'ZZZ',
};

const STATUS_CONFIG = {
  valid: { symbol: '\u25CF', color: 'text-sd-success', label: 'Valid' },
  invalid: { symbol: '\u25CB', color: 'text-sd-error', label: 'Invalid' },
  unknown: { symbol: '\u25D0', color: 'text-sd-secondary', label: 'Checking...' },
} as const;

type AuthStatus = keyof typeof STATUS_CONFIG;

interface AccountCardProps {
  account: HoyoAccount;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Displays a single account card with name, auth status, game UIDs, and edit/delete actions.
 */
export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const statusKey = (account.authStatus in STATUS_CONFIG
    ? account.authStatus
    : 'unknown') as AuthStatus;
  const status = STATUS_CONFIG[statusKey];

  const gameUids = (Object.entries(account.uids) as [GameId, string][]).filter(
    ([, uid]) => uid,
  );

  return (
    <div className="flex flex-col gap-1.5 p-2.5 border border-sd-border rounded bg-sd-input/50">
      {/* Header: name + status */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-sd-text">{account.name}</span>
        <span className={`text-[11px] ${status.color}`}>
          {status.symbol} {status.label}
        </span>
      </div>

      {/* Game UIDs */}
      {gameUids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gameUids.map(([game, uid]) => (
            <span
              key={game}
              className="text-[10px] text-sd-secondary bg-sd-bg px-1.5 py-0.5 rounded"
            >
              {GAME_LABELS[game]}: {uid}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <Button onClick={onEdit}>Edit</Button>
        <Button onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
