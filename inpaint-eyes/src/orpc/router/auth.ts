import { os } from '@orpc/server'
import { z } from 'zod'
import { env } from '@/env'

export const verifyPassword = os
  .input(z.object({ password: z.string() }))
  .handler(({ input }) => {
    const valid = input.password === env.APP_PASSWORD
    return { valid }
  })
