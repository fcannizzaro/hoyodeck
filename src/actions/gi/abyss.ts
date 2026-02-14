import { action, type KeyAction } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "@/types/settings";
import { formatDaysRemaining } from "@/utils/time";

/**
 * Spiral Abyss Action
 * Displays days remaining and star count
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.abyss" })
export class AbyssAction extends BaseAction<GenshinActionSettings> {
  protected override async refresh(
    action: KeyAction<GenshinActionSettings>,
    settings: GenshinActionSettings,
  ): Promise<void> {
    const ctx = await this.getAccountContext(settings);
    if (!ctx) {
      await this.showNoAccount(action);
      return;
    }

    const uid = this.getGameUid(ctx.account, "genshin");
    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const abyss = await ctx.client.getGenshinSpiralAbyss(uid);

    // Calculate days remaining
    const endDate = new Date(parseInt(abyss.end_time) * 1000);
    const daysLeft = formatDaysRemaining(endDate);

    // Format: "Stars\nDays"
    await action.setTitle(`${abyss.total_star}*\n${daysLeft}`);
  }
}
