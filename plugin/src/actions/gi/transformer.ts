import { action, type KeyAction } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { TransformerSettings } from "@/types/settings";
import type { DataType, DataUpdate } from "@/services/data-controller.types";
import { formatTransformerTime } from "@/utils/time";

/**
 * Parametric Transformer Action
 * Displays transformer cooldown or ready state
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.transformer" })
export class TransformerAction extends BaseAction<TransformerSettings, 'gi:daily-note'> {
  protected readonly game = 'gi' as const;

  protected getSubscribedDataTypes(): DataType[] {
    return ['gi:daily-note'];
  }

  protected override async onDataUpdate(
    action: KeyAction<TransformerSettings>,
    update: DataUpdate<'gi:daily-note'>,
  ): Promise<void> {
    if (update.entry.status === 'error') {
      await this.showError(action);
      return;
    }

    const dailyNote = update.entry.data;

    if (!dailyNote.transformer.obtained) {
      await action.setTitle("N/A");
      return;
    }

    const state = dailyNote.transformer.recovery_time.reached ? 1 : 0;
    const display = formatTransformerTime(dailyNote.transformer.recovery_time);
    await action.setTitle(state ? "" : display);
    await action.setState(state);
  }
}
