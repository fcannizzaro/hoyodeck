import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function getContext() {
  const queryClient = new QueryClient()
  return {
    queryClient,
  }
}

export default function TanStackQueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
