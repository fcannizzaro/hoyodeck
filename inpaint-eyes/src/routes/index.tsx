import { useState, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, Loader2 } from 'lucide-react'
import { setPassword, getPassword } from '@/lib/auth-store'
import { client } from '@/orpc/client'

export const Route = createFileRoute('/')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [password, setPasswordValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If already authenticated, redirect
  if (typeof window !== 'undefined' && getPassword()) {
    navigate({ to: '/editor' })
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!password) return

      setIsLoading(true)
      setError(null)

      try {
        setPassword(password)
        const result = await client.verifyPassword({ password })

        if (result.valid) {
          navigate({ to: '/editor' })
        } else {
          setError('Invalid password')
          setPassword('')
        }
      } catch {
        setError('Failed to verify password')
        setPassword('')
      } finally {
        setIsLoading(false)
      }
    },
    [password, navigate],
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <Eye className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">inpaint-eyes</h1>
          <p className="text-sm text-muted-foreground">
            Create closed-eyes avatar variants
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="Enter password"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive-foreground">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || !password}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Enter'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
