import { os, ORPCError } from '@orpc/server'
import { z } from 'zod'
import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { authMiddleware } from '@/orpc/middleware/auth'
import { SaveAvatarSchema } from '@/orpc/schema'

const AVATARS_DIR = join(process.cwd(), 'public', 'avatars')

const authed = os.use(authMiddleware)

export const listAvatars = authed
  .input(z.object({}))
  .handler(async () => {
    const entries = await readdir(AVATARS_DIR).catch(() => [] as string[])
    return entries
      .filter((f) => f.endsWith('.png'))
      .map((f) => ({
        name: f.replace(/\.png$/, ''),
        url: `/avatars/${f}`,
      }))
  })

export const saveAvatar = authed
  .input(SaveAvatarSchema)
  .handler(async ({ input }) => {
    const buffer = Buffer.from(input.imageBase64, 'base64')

    // Validate it's a real image and convert to PNG
    try {
      await sharp(buffer).metadata()
    } catch {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Invalid image data',
      })
    }

    const filePath = join(AVATARS_DIR, `${input.name}.png`)

    let overwritten = false
    try {
      await readdir(AVATARS_DIR)
      const { readFile } = await import('node:fs/promises')
      await readFile(filePath)
      overwritten = true
    } catch {
      // File doesn't exist, that's fine
    }

    const pngBuffer = await sharp(buffer).png().toBuffer()
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(AVATARS_DIR, { recursive: true })
    await writeFile(filePath, pngBuffer)

    return {
      url: `/avatars/${input.name}.png`,
      overwritten,
    }
  })

export const deleteAvatar = authed
  .input(z.object({ name: z.string().min(1) }))
  .handler(async ({ input }) => {
    const filePath = join(AVATARS_DIR, `${input.name}.png`)
    try {
      await unlink(filePath)
      return { success: true }
    } catch {
      throw new ORPCError('NOT_FOUND', {
        message: `Avatar "${input.name}" not found`,
      })
    }
  })
