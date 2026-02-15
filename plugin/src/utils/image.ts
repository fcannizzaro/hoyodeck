import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { cache, CacheTTL } from '@/services/cache';

/** Directory containing the compiled plugin binary */
const PLUGIN_DIR = resolve(dirname(__filename), '..');

/**
 * Read a local image file and return it as a base64 data URI.
 * Results are cached in-memory for the lifetime of the process.
 * @param relativePath Path relative to the plugin directory (e.g. "imgs/actions/gi/daily.png")
 * @returns Base64 data URI string (e.g. "data:image/png;base64,...")
 */
export const readLocalImageAsDataUri = (relativePath: string): string => {
  const cacheKey = `local-image:${relativePath}`;
  const cached = cache.get<string>(cacheKey);

  if (cached) {
    return cached;
  }

  const absolutePath = resolve(PLUGIN_DIR, relativePath);
  const buffer = readFileSync(absolutePath);
  const base64 = buffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;

  cache.set(cacheKey, dataUri, CacheTTL.STATIC);

  return dataUri;
};

/**
 * Check whether a local image file exists relative to the plugin directory.
 * @param relativePath Path relative to the plugin directory (e.g. "imgs/banner/evernight-closed.png")
 * @returns true if the file exists on disk
 */
export const localImageExists = (relativePath: string): boolean => {
  const absolutePath = resolve(PLUGIN_DIR, relativePath);
  return existsSync(absolutePath);
};

/**
 * Fetch a remote image and return it as a base64 data URI.
 * Results are cached in-memory for 1 hour.
 * @param url Remote image URL
 * @returns Base64 data URI string (e.g. "data:image/png;base64,...")
 */
export const fetchImageAsDataUri = async (url: string): Promise<string> => {
  const cacheKey = `image:${url}`;
  const cached = cache.get<string>(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString('base64');
  const contentType = response.headers.get('content-type') ?? 'image/png';
  const dataUri = `data:${contentType};base64,${base64}`;

  cache.set(cacheKey, dataUri, CacheTTL.STATIC);

  return dataUri;
};
