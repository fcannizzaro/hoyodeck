import type { GameRole } from "@hoyodeck/shared/types";

const SERVER_NAMES: Record<string, string> = {
  os_usa: "America",
  os_euro: "Europe",
  os_asia: "Asia",
  os_cht: "TW / HK / MO",
  prod_official_usa: "America",
  prod_official_eur: "Europe",
  prod_official_asia: "Asia",
  prod_official_cht: "TW / HK / MO",
  prod_gf_us: "America",
  prod_gf_eu: "Europe",
  prod_gf_jp: "Asia",
  prod_gf_sg: "TW / HK / MO",
  cn_gf01: "China",
  cn_qd01: "China (Bilibili)",
  prod_gf_cn: "China",
  prod_qd_cn: "China (Bilibili)",
};

export function roleLabel(role: GameRole): string {
  return [SERVER_NAMES[role.region] ?? role.region, role.nickname, role.uid]
    .filter(Boolean)
    .join(" · ");
}
