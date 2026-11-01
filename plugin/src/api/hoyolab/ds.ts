import { createHash } from "crypto";
import type { HoyoRegion } from "@hoyodeck/shared/types";

/**
 * DS (Dynamic Secret) salt for overseas HoYoLAB API
 * This may need to be updated if HoYoverse changes it
 */
const OS_DS_SALT = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";

/** 4X salt used by MiYouShe's client-type 5 game-record endpoints. */
const CN_DS_SALT = "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs";

/** Separate DS1 salt used by MiYouShe's daily check-in endpoints. */
const CN_CHECK_IN_DS_SALT = "LyD1rXqMv2GJhnwdvCBjFOKGiKuLY3aO";

/**
 * Lowercase letters and digits for random string generation
 */
const CHARACTERS = "abcdefghijklmnopqrstuvwxyz0123456789";
const ASCII_LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generate a random string of specified length
 */
function randomString(length: number, characters = CHARACTERS): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Generate MD5 hash of a string
 */
function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/**
 * Generate Dynamic Secret (DS) for HoYoLAB API requests
 *
 * The DS format is: "{timestamp},{random},{md5(salt={SALT}&t={timestamp}&r={random})}"
 *
 * This is required for most HoYoLAB API endpoints to prevent request tampering.
 */
function generateOverseasDS(salt = OS_DS_SALT, characters = CHARACTERS): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = randomString(6, characters);
  const hash = md5(`salt=${salt}&t=${timestamp}&r=${random}`);
  return `${timestamp},${random},${hash}`;
}

/** Generate MiYouShe's DS2 signature, which covers sorted query/body data. */
function generateCnDS(query?: Record<string, string>, body?: Record<string, unknown>): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.floor(Math.random() * 100_000) + 100_001;
  const bodyString = body ? JSON.stringify(sortObject(body)) : "";
  const queryString = query
    ? Object.entries(query)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("&")
    : "";
  const hash = md5(
    `salt=${CN_DS_SALT}&t=${timestamp}&r=${random}&b=${bodyString}&q=${queryString}`,
  );
  return `${timestamp},${random},${hash}`;
}

function sortObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right)),
  );
}

/** Generate the correct DS signature for a HoYoLAB or MiYouShe request. */
export function generateDS(
  region: HoyoRegion = "global",
  query?: Record<string, string>,
  body?: Record<string, unknown>,
): string {
  return region === "cn" ? generateCnDS(query, body) : generateOverseasDS();
}

/** Generate the app-style DS1 signature used by CN daily check-in. */
export function generateCnCheckInDS(): string {
  return generateOverseasDS(CN_CHECK_IN_DS_SALT, ASCII_LETTERS);
}
