import { useQuery } from "@tanstack/react-query";
import { fetchImageAsDataUri } from "@/utils/image";

/**
 * Fetch a remote image and return it as a base64 data URI via React Query.
 *
 * The query is disabled when `url` is `null`/`undefined`, so callers can
 * pass a conditional URL without worrying about wasted fetches.
 *
 * Results are cached by URL in the shared QueryClient — identical URLs
 * across different action roots resolve instantly from cache.
 *
 * @param url - Remote image URL, or nullish to skip the fetch
 * @returns The data URI string, or `null` while loading / on error
 */
export function useImageDataUri(url: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ["image", url],
    queryFn: () => fetchImageAsDataUri(url!),
    enabled: !!url,
  });

  return data ?? null;
}
