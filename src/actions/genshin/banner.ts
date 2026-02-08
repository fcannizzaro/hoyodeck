import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { BannerSettings } from "../../types/settings";
import type { GenshinBannerPool } from "../../api/types/genshin";
import { buildBannerSvg, formatCountdownFromSeconds } from "../../utils/banner";
import { fetchImageAsDataUri } from "../../utils/image";

/**
 * Banner Action
 * Displays current Genshin Impact wish banner info from the HoYoLab act calendar API.
 * Key press cycles through multiple concurrent character banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.banner" })
export class BannerAction extends BaseAction<BannerSettings> {
  /** Current index for cycling through character banners */
  private bannerIndex = 0;

  /**
   * Get the featured icon URL from a banner pool.
   * For character pools: first rarity-5 avatar icon.
   * For weapon pools: first rarity-5 weapon icon.
   */
  private getFeaturedIcon(
    pool: GenshinBannerPool,
    type: "character" | "weapon",
  ): string | undefined {
    if (type === "weapon") {
      return pool.weapon.find((w) => w.rarity === 5)?.icon;
    }

    return pool.avatars.find((a) => a.rarity === 5)?.icon;
  }

  override async onKeyDown(ev: KeyDownEvent<BannerSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const type = settings.type ?? "character";

    // Cycle through character banners on key press
    if (type === "character") {
      this.bannerIndex++;
    }

    await this.withErrorHandling(ev.action, async () => {
      await this.refresh(ev.action, settings);
    });
  }

  protected override async refresh(
    action: KeyAction<BannerSettings>,
    settings: BannerSettings,
  ): Promise<void> {
    const client = await this.getClient();

    if (!client) {
      await this.showNoAuth(action);
      return;
    }

    const uid = await this.getUid(settings);

    if (!uid) {
      await this.showNoUid(action);
      return;
    }

    const calendar = await client.getGenshinActCalendar(uid);

    const type = settings.type ?? "character";

    if (type === "character") {
      await this.displayCharacterBanner(
        action,
        calendar.selected_avatar_card_pool_list,
      );
    } else {
      await this.displayWeaponBanner(action, calendar.weapon_card_pool_list);
    }
  }

  private async displayCharacterBanner(
    action: KeyAction<BannerSettings>,
    pools: GenshinBannerPool[],
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const index = this.bannerIndex % pools.length;
    const pool = pools[index]!;
    const countdown = formatCountdownFromSeconds(pool.countdown_seconds);

    const iconUrl = this.getFeaturedIcon(pool, "character");
    if (iconUrl) {
      const dataUri = await fetchImageAsDataUri(iconUrl);
      const svg = buildBannerSvg(dataUri, countdown);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }

  private async displayWeaponBanner(
    action: KeyAction<BannerSettings>,
    pools: GenshinBannerPool[],
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const pool = pools[0]!;
    const countdown = formatCountdownFromSeconds(pool.countdown_seconds);

    const iconUrl = this.getFeaturedIcon(pool, "weapon");
    if (iconUrl) {
      const dataUri = await fetchImageAsDataUri(iconUrl);
      const svg = buildBannerSvg(dataUri, countdown);
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }
}
