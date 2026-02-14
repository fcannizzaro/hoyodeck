import { createHash } from 'crypto';

/**
 * DS (Dynamic Secret) salt for overseas HoYoLAB API
 * This may need to be updated if HoYoverse changes it
 */
const OS_DS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt';

/**
 * Lowercase letters and digits for random string generation
 */
const CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random string of specified length
 */
function randomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }
  return result;
}

/**
 * Generate MD5 hash of a string
 */
function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

/**
 * Generate Dynamic Secret (DS) for HoYoLAB API requests
 *
 * The DS format is: "{timestamp},{random},{md5(salt={SALT}&t={timestamp}&r={random})}"
 *
 * This is required for most HoYoLAB API endpoints to prevent request tampering.
 */
export function generateDS(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = randomString(6);
  const hash = md5(`salt=${OS_DS_SALT}&t=${timestamp}&r=${random}`);
  return `${timestamp},${random},${hash}`;
}

/**
 * Generate DS with query/body parameters (for some endpoints)
 */
export function generateDSWithParams(
  query: string = '',
  body: string = ''
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = randomString(6);
  const hash = md5(
    `salt=${OS_DS_SALT}&t=${timestamp}&r=${random}&b=${body}&q=${query}`
  );
  return `${timestamp},${random},${hash}`;
}
