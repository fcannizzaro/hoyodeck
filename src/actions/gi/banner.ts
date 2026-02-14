import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { BaseAction } from "../base/base-action";
import type { BannerSettings } from "@/types/settings";
import type { GenshinBannerPool } from "@/api/types/genshin";
import { buildBannerSvg, formatCountdownFromSeconds } from "@/utils/banner";
import { fetchImageAsDataUri } from "@/utils/image";

/**
 * Banner Action
 * Displays current Genshin Impact wish banner info from the HoYoLab act calendar API.
 * Key press cycles through multiple concurrent banners.
 */
@action({ UUID: "com.fcannizzaro.hoyodeck.genshin.banner" })
export class BannerAction extends BaseAction<BannerSettings> {
  /** Current index for cycling through banners */
  private bannerIndex = 0;

  override async onKeyDown(ev: KeyDownEvent<BannerSettings>): Promise<void> {
    this.bannerIndex++;

    await this.withErrorHandling(ev.action, async () => {
      await this.refresh(ev.action, ev.payload.settings);
    });
  }

  protected override async refresh(
    action: KeyAction<BannerSettings>,
    settings: BannerSettings,
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

    const calendar = await ctx.client.getGenshinActCalendar(uid);
    const type = settings.type ?? "character";

    if (type === "character") {
      await this.displayCharacterBanner(action, calendar.avatar_card_pool_list);
    } else {
      await this.displayWeaponBanner(action, calendar.weapon_card_pool_list);
    }
  }

  private getActiveBanners(pools: GenshinBannerPool[]): GenshinBannerPool[] {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return pools.filter((pool) => {
      const start = Number(pool.start_timestamp);
      const end = Number(pool.end_timestamp);
      return nowSeconds > start && nowSeconds < end;
    });
  }

  private async displayCharacterBanner(
    action: KeyAction<BannerSettings>,
    pools: GenshinBannerPool[],
  ): Promise<void> {
    if (pools.length === 0) {
      await action.setTitle("No\nBanner");
      return;
    }

    const items = this.getActiveBanners(pools).flatMap((pool) =>
      pool.avatars
        .filter((a) => a.rarity === 5)
        .map((a) => ({
          icon: a.icon,
          countdown_seconds: pool.countdown_seconds,
        })),
    );

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(item.countdown_seconds);
      const dataUri = await fetchImageAsDataUri(item.icon);
      const svg = buildBannerSvg(dataUri, countdown, "genshin");
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

    const items = this.getActiveBanners(pools).flatMap((pool) =>
      pool.weapon
        .filter((w) => w.rarity === 5)
        .map((w) => ({
          icon: w.icon,
          countdown_seconds: pool.countdown_seconds,
        })),
    );

    const index = this.bannerIndex % items.length;
    const item = items[index];

    if (item) {
      const countdown = formatCountdownFromSeconds(item.countdown_seconds);
      const dataUri = await fetchImageAsDataUri(item.icon);
      const svg = buildBannerSvg(dataUri, countdown, "genshin");
      const base64 = `data:image/svg+xml;base64,${btoa(svg)}`;
      await action.setTitle("");
      await action.setImage(base64);
    }
  }
}
