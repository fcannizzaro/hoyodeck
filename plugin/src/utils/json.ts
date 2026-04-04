import type { JsonObject } from "@elgato/utils";
import type { GlobalSettings } from "@hoyodeck/shared/types";

/** Cast GlobalSettings to JsonObject for SDK calls */
export const toJsonObject = (settings: GlobalSettings): JsonObject =>
  settings as unknown as JsonObject;
