import { action, type KeyAction } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { GenshinActionSettings } from "@/types/settings";
import type { DataType, SuccessDataUpdate } from "@/services/data-controller.types";
import { formatDaysRemaining } from "@/utils/time";

/**
 * Spiral Abyss Action
 * Displays days remaining and star count
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.abyss" })
export class AbyssAction extends BaseAction<GenshinActionSettings, 'gi:spiral-abyss'> {
  protected readonly game = 'gi' as const;

  protected getSubscribedDataTypes(): DataType[] {
    return ['gi:spiral-abyss'];
  }

  protected override async onDataUpdate(
    action: KeyAction<GenshinActionSettings>,
    update: SuccessDataUpdate<'gi:spiral-abyss'>,
  ): Promise<void> {
    const abyss = update.entry.data;

    // Calculate days remaining
    const endDate = new Date(parseInt(abyss.end_time) * 1000);
    const daysLeft = formatDaysRemaining(endDate);

    // Format: "Stars\nDays"
    await action.setTitle(`${abyss.total_star}*\n${daysLeft}`);
  }
}
