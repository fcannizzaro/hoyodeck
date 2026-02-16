import { os, ORPCError } from '@orpc/server'
import { GoogleGenAI } from '@google/genai'
import { authMiddleware } from '@/orpc/middleware/auth'
import { InpaintSchema } from '@/orpc/schema'
import { env } from '@/env'

const authed = os.use(authMiddleware)

export const generateInpaint = authed
  .input(InpaintSchema)
  .handler(async ({ input }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: input.imageBase64,
                },
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: input.maskBase64,
                },
              },
              {
                text: `The second image is a mask where white regions indicate the eyes area. ${input.prompt}. Keep everything else exactly the same. Maintain the same art style, colors, and quality.`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      })

      const parts = response.candidates?.[0]?.content?.parts
      if (!parts) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: 'No response from AI model',
        })
      }

      const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'))
      if (!imagePart?.inlineData?.data) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: 'AI model did not generate an image. Try a different prompt.',
        })
      }

      return {
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType ?? 'image/png',
      }
    } catch (error) {
      if (error instanceof ORPCError) throw error

      const message = error instanceof Error ? error.message : 'Unknown error'

      if (message.includes('SAFETY')) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Image was blocked by safety filters. Try a different image or prompt.',
        })
      }

      throw new ORPCError('INTERNAL_SERVER_ERROR', {
        message: `AI generation failed: ${message}`,
      })
    }
  })
