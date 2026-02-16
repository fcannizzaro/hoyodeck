import { z } from 'zod'

export const SaveAvatarSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric and hyphens only'),
  imageBase64: z.string().min(1),
})

export const InpaintSchema = z.object({
  imageBase64: z.string().min(1),
  maskBase64: z.string().min(1),
  prompt: z.string().default('close the eyes, eyes closed, sleeping'),
})

export const AvatarInfoSchema = z.object({
  name: z.string(),
  url: z.string(),
})
