import { useStreamDeck } from "../hooks/use-stream-deck";
import { Heading } from "../components/Heading";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import { GameIcon } from "../components/GameIcon";
import type { GameId, PatchCountdownSlot } from "@hoyodeck/shared/types";
import { GAME_LABELS_EXTENDED } from "@hoyodeck/shared/games";

const MAX_SLOTS = 3;

const ALL_GAMES: GameId[] = ["gi", "hsr", "zzz"];

const GAME_OPTIONS = ALL_GAMES.map((id) => ({
  value: id,
  label: GAME_LABELS_EXTENDED[id],
}));

// ─── Slot Row Component ───────────────────────────────────────────

interface SlotRowProps {
  slot: PatchCountdownSlot;
  index: number;
  onUpdate: (index: number, slot: PatchCountdownSlot) => void;
  onRemove: (index: number) => void;
}

function SlotRow({ slot, index, onUpdate, onRemove }: SlotRowProps) {
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
        onChange={(value) => onUpdate(index, { game: value as GameId })}
      />
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────

export function PatchCountdownPanel() {
  const { settings, saveSettings } = useStreamDeck();
  const slots: PatchCountdownSlot[] = (settings.slots as PatchCountdownSlot[] | undefined) ?? [];

  const updateSlot = (index: number, updated: PatchCountdownSlot) => {
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

    saveSettings({ slots: [...slots, { game }] });
  };

  return (
    <div className="flex flex-col gap-2">
      <Heading>Patch Countdown</Heading>

      {slots.length === 0 && (
        <p className="text-[11px] text-sd-secondary">
          Add game slots to display version countdown.
        </p>
      )}

      {/* Slot list */}
      <div className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <SlotRow
            key={`${slot.game}-${i}`}
            slot={slot}
            index={i}
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
    </div>
  );
}
