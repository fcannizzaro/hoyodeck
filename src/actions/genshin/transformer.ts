import { action, type KeyAction } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { TransformerSettings } from "../../types/settings";
import { formatTransformerTime } from "../../utils/time";

/**
 * Parametric Transformer Action
 * Displays transformer cooldown or ready state
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.transformer" })
export class TransformerAction extends BaseAction<TransformerSettings> {
  protected override async refresh(
    action: KeyAction<TransformerSettings>,
    settings: TransformerSettings,
  ): Promise<void> {
    const ctx = await this.getAccountContext(settings);
    if (!ctx) {
      await this.showNoAccount(action);
      return;
    }

    const uid = this.getGameUid(ctx.account, 'genshin');
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const dailyNote = await ctx.client.getGenshinDailyNote(uid);

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
