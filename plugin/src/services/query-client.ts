import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient singleton used across all action roots.
 *
 * Module-level so every `QueryClientProvider` shares the same cache —
 * an image fetched by one banner action is instantly available to others.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Images and remote assets rarely change — keep them fresh for 1h */
      staleTime: 60 * 60 * 1000,
      /** Retry once on network failure */
      retry: 1,
      /** Never refetch on window focus (no windows in Stream Deck runtime) */
      refetchOnWindowFocus: false,
    },
  },
});
