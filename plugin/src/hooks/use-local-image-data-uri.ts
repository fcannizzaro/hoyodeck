import { useMemo } from "react";
import { readLocalImageAsDataUri } from "@/utils/image";

/**
 * Lazily read a local image file and return it as a base64 data URI.
 *
 * Unlike calling `readLocalImageAsDataUri` at module scope, the filesystem
 * read is deferred until the component that uses the hook actually mounts.
 * Subsequent renders return the same cached value.
 *
 * @param relativePath - Path relative to the plugin directory (e.g. "imgs/actions/gi/resin.webp")
 * @returns Base64 data URI string
 */
export function useLocalImageDataUri(relativePath: string): string {
  return useMemo(() => readLocalImageAsDataUri(relativePath), [relativePath]);
}
