import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getPassword } from '@/lib/auth-store'
import { orpc, client } from '@/orpc/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { RefreshCw, Loader2, X, Copy, Check } from 'lucide-react'

type GameId = 'gi' | 'hsr' | 'zzz'
type GameFilter = GameId | 'all'

const GAME_LABELS: Record<GameFilter, string> = {
  all: 'All',
  gi: 'Genshin Impact',
  hsr: 'Star Rail',
  zzz: 'Zenless Zone Zero',
}

const GAME_BADGES: Record<GameId, { label: string; className: string }> = {
  gi: { label: 'GI', className: 'bg-amber-500/20 text-amber-400' },
  hsr: { label: 'HSR', className: 'bg-blue-500/20 text-blue-400' },
  zzz: { label: 'ZZZ', className: 'bg-emerald-500/20 text-emerald-400' },
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-sky-500/20 text-sky-400' },
  claimed: { label: 'Claimed', className: 'bg-green-500/20 text-green-400' },
  dismissed: { label: 'Dismissed', className: 'bg-zinc-500/20 text-zinc-400' },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-400' },
  expired: { label: 'Expired', className: 'bg-orange-500/20 text-orange-400' },
}

export const Route = createFileRoute('/codes')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !getPassword()) {
      throw redirect({ to: '/' })
    }
  },
  component: CodesPage,
})

function CodesPage() {
  const queryClient = useQueryClient()
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [isCrawling, setIsCrawling] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const queryInput = gameFilter === 'all' ? {} : { game: gameFilter as GameId }
  const queryOptions = orpc.listCodes.queryOptions({ input: queryInput })
  const { data: codes, isLoading } = useQuery(queryOptions)

  const handleCrawl = async () => {
    setIsCrawling(true)
    try {
      await client.triggerCrawl({})
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
    } finally {
      setIsCrawling(false)
    }
  }

  const handleDismiss = async (codeId: number) => {
    // Dismiss without accountId for now (global dismiss)
    await client.dismissCode({ codeId, accountId: '_global' })
    queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Redeem Codes</h1>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCrawl}
            disabled={isCrawling}
          >
            {isCrawling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>

        {/* Game filter tabs */}
        <div className="flex gap-1">
          {(Object.keys(GAME_LABELS) as GameFilter[]).map((game) => (
            <Button
              key={game}
              size="sm"
              variant={gameFilter === game ? 'default' : 'ghost'}
              onClick={() => setGameFilter(game)}
              className="text-xs"
            >
              {game === 'all' ? 'All' : GAME_LABELS[game]}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !codes?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No codes found. Try refreshing.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {codes.map((code) => {
              const gameBadge = GAME_BADGES[code.game as GameId]
              const status = (code.claim_status as string) ?? 'new'
              const statusBadge = STATUS_BADGES[status] ?? STATUS_BADGES['new']!

              return (
                <Card key={code.id}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    {/* Game badge */}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${gameBadge?.className}`}
                    >
                      {gameBadge?.label}
                    </span>

                    {/* Code + rewards */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-semibold">
                          {code.code}
                        </code>
                        <button
                          onClick={() => handleCopy(code.code)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      {code.rewards && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {code.rewards}
                        </p>
                      )}
                    </div>

                    {/* Source + date */}
                    <div className="text-right text-xs text-muted-foreground hidden sm:block">
                      {code.source && <div>{code.source}</div>}
                      <div>{formatDate(code.discovered_at)}</div>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge?.className}`}
                    >
                      {statusBadge?.label}
                    </span>

                    {/* Dismiss button */}
                    {status === 'new' && (
                      <button
                        onClick={() => handleDismiss(code.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
