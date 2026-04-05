import { useMemo } from "react";
import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import { GameIcon } from "../components/GameIcon";
import type {
  GameId,
  HoyoAccountInfo,
  WishTrackerSlot,
  WishTrackerBannerType,
  WishPityData,
} from "@hoyodeck/shared/types";
import { GAME_LABELS_EXTENDED } from "@hoyodeck/shared/games";

// ─── Constants ────────────────────────────────────────────────────

const MAX_SLOTS = 3;

const ALL_GAMES: GameId[] = ["gi", "hsr", "zzz"];

const GAME_OPTIONS = ALL_GAMES.map((id) => ({
  value: id,
  label: GAME_LABELS_EXTENDED[id],
}));

/** Banner type options per game */
const BANNER_TYPE_OPTIONS: Record<GameId, { value: string; label: string }[]> = {
  gi: [
    { value: "character", label: "Character Event Wish" },
    { value: "weapon", label: "Weapon Event Wish" },
  ],
  hsr: [
    { value: "character", label: "Character Warp" },
    { value: "lightcone", label: "Light Cone Warp" },
  ],
  zzz: [
    { value: "character", label: "Agent Signal Search" },
    { value: "w-engine", label: "W-Engine Signal Search" },
  ],
};

/** Hard pity values for display reference */
const HARD_PITY: Record<GameId, Record<string, number>> = {
  gi: { character: 90, weapon: 80 },
  hsr: { character: 90, lightcone: 80 },
  zzz: { character: 90, "w-engine": 80 },
};

// ─── Slot Row Component ───────────────────────────────────────────

interface SlotRowProps {
  slot: WishTrackerSlot;
  index: number;
  accounts: Record<string, HoyoAccountInfo>;
  onUpdate: (index: number, slot: WishTrackerSlot) => void;
  onRemove: (index: number) => void;
}

function SlotRow({ slot, index, accounts, onUpdate, onRemove }: SlotRowProps) {
  // Filter accounts that have a UID for the selected game
  const accountOptions = useMemo(() => {
    const filtered = Object.values(accounts).filter((a) => a.uids?.[slot.game] !== undefined);
    return [
      { value: "", label: "Select account..." },
      ...filtered.map((a) => ({
        value: a.id,
        label: `${a.name}${a.authStatus === "invalid" ? " (invalid)" : ""}`,
      })),
    ];
  }, [accounts, slot.game]);

  return (
    <div className="flex flex-col gap-1.5 p-2.5 bg-sd-input/50 border border-sd-border rounded">
      {/* Header: slot number + game icon + remove button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GameIcon game={slot.game} size={14} />
          <span className="text-[11px] font-medium text-sd-secondary">Slot {index + 1}</span>
        </div>
        <button
          onClick={() => onRemove(index)}
          className="text-[10px] text-sd-secondary hover:text-red-400 transition-colors cursor-pointer px-1"
          title="Remove slot"
        >
          Remove
        </button>
      </div>

      {/* Game selector */}
      <Select
        label="Game"
        value={slot.game}
        options={GAME_OPTIONS}
        onChange={(value) => onUpdate(index, { ...slot, game: value as GameId, accountId: "" })}
      />

      {/* Account selector */}
      <Select
        label="Account"
        value={slot.accountId}
        options={accountOptions}
        onChange={(value) => onUpdate(index, { ...slot, accountId: value })}
      />

      {/* Warning if no accounts have this game's UID */}
      {accountOptions.length <= 1 && (
        <p className="text-[10px] text-amber-400/80">
          No accounts with a {GAME_LABELS_EXTENDED[slot.game]} UID
        </p>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────

export function WishTrackerPanel() {
  const { settings, saveSettings, globalSettings } = useStreamDeck();

  const accounts = (globalSettings.accounts ?? {}) as Record<string, HoyoAccountInfo>;
  const slots: WishTrackerSlot[] = (settings.slots as WishTrackerSlot[] | undefined) ?? [];
  const activeSlot = (settings.activeSlot as number) ?? 0;
  const activeGame: GameId = slots[activeSlot]?.game ?? "gi";
  const bannerType = (settings.bannerType as WishTrackerBannerType) ?? "character";

  // Read pity data from global settings
  const wishTrackers = (globalSettings.wishTrackers ?? {}) as Record<string, WishPityData>;
  const key = `${activeGame}:${bannerType}`;
  const pityData = wishTrackers[key] ?? { pity: 0, guaranteed: false };
  const hardPity = HARD_PITY[activeGame]?.[bannerType] ?? 90;

  const updateSlot = (index: number, updated: WishTrackerSlot) => {
    const next = [...slots];
    next[index] = updated;
    saveSettings({ slots: next });
  };

  const removeSlot = (index: number) => {
    const next = slots.filter((_, i) => i !== index);
    saveSettings({ slots: next });
  };

  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return;

    // Pick a game that isn't already in a slot (if possible)
    const usedGames = new Set(slots.map((s) => s.game));
    const available = ALL_GAMES.filter((g) => !usedGames.has(g));
    const game = available[0] ?? "gi";

    // Auto-select account if exactly one has this game's UID
    const candidates = Object.values(accounts).filter((a) => a.uids?.[game] !== undefined);
    const accountId = candidates.length === 1 ? candidates[0]!.id : "";

    saveSettings({ slots: [...slots, { game, accountId }] });
  };

  const handleBannerTypeChange = (value: string) => {
    saveSettings({ bannerType: value });
  };

  return (
    <div className="flex flex-col gap-2">
      <Heading>Wish Tracker</Heading>

      {slots.length === 0 && (
        <p className="text-[11px] text-sd-secondary">
          Add game slots to track pity on the encoder.
        </p>
      )}

      {/* Slot list */}
      <div className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <SlotRow
            key={`${slot.game}-${slot.accountId}-${i}`}
            slot={slot}
            index={i}
            accounts={accounts}
            onUpdate={updateSlot}
            onRemove={removeSlot}
          />
        ))}
      </div>

      {/* Add button */}
      {slots.length < MAX_SLOTS && <Button onClick={addSlot}>+ Add Slot</Button>}

      {slots.length >= MAX_SLOTS && (
        <p className="text-[10px] text-sd-secondary text-center">Maximum {MAX_SLOTS} slots</p>
      )}

      {/* Banner type selector — applies to the active game */}
      {slots.length > 0 && (
        <Select
          label="Banner Type"
          value={bannerType}
          options={BANNER_TYPE_OPTIONS[activeGame]}
          info={`Hard pity: ${hardPity} wishes`}
          onChange={handleBannerTypeChange}
        />
      )}

      {/* Current pity state */}
      {slots.length > 0 && (
        <div className="flex flex-col gap-1 mt-1 p-2.5 bg-sd-input/50 border border-sd-border rounded">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-sd-secondary">Current Pity</span>
            <span className="text-[11px] font-semibold text-sd-text">
              {pityData.pity} / {hardPity}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-sd-secondary">Remaining</span>
            <span className="text-[11px] font-semibold text-sd-text">
              {Math.max(0, hardPity - pityData.pity)}
            </span>
          </div>
        </div>
      )}

      {/* Usage instructions */}
      <div className="flex flex-col gap-1 mt-1 p-2.5 bg-sd-input/30 border border-sd-border rounded">
        <span className="text-[11px] font-medium text-sd-secondary uppercase tracking-wider">
          How to use
        </span>
        <ul className="text-[10px] text-sd-secondary leading-relaxed list-disc pl-3">
          <li>
            Touch display: <strong>change game</strong>
          </li>
          <li>
            Long touch: <strong>reset</strong> pity to 0
          </li>
          <li>
            Rotate dial: <strong>+1</strong> pity per tick
          </li>
          <li>
            Press dial: <strong>+10</strong> pity
          </li>
        </ul>
      </div>
    </div>
  );
}
