import { os, ORPCError } from '@orpc/server'
import { env } from '@/env'

/**
 * oRPC middleware that validates the x-app-password header.
 * Apply to all protected procedures.
 */
export const authMiddleware = os.middleware(async ({ context, next }) => {
  const ctx = context as { headers?: Headers }
  const password = ctx.headers?.get?.('x-app-password')

  if (!password || password !== env.APP_PASSWORD) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Invalid or missing password',
    })
  }

  return next({})
})
