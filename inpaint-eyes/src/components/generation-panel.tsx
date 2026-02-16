import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropZone } from '@/components/drop-zone'
import { Loader2, Wand2, Layers } from 'lucide-react'
import { client } from '@/orpc/client'

import type { CanvasManager } from '@/lib/canvas-manager'

interface GenerationPanelProps {
  canvasManager: CanvasManager | null
  onResult: (resultBase64: string) => void
}

export function GenerationPanel({ canvasManager, onResult }: GenerationPanelProps) {
  const [prompt, setPrompt] = useState(
    'close the eyes, eyes closed',
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleManualOverlay = useCallback(
    (img: HTMLImageElement) => {
      if (!canvasManager) return
      if (!canvasManager.hasMask()) {
        setError('Please draw a mask first before applying an overlay.')
        return
      }
      setError(null)
      const resultBase64 = canvasManager.compositeWithOverlay(img, 3)
      onResult(resultBase64)
    },
    [canvasManager, onResult],
  )

  const handleAIGenerate = useCallback(async () => {
    if (!canvasManager) return
    if (!canvasManager.hasMask()) {
      setError('Please draw a mask first before generating.')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const imageBase64 = canvasManager.getImageAsBase64()
      const maskBase64 = canvasManager.getMaskAsBase64()

      const result = await client.generateInpaint({
        imageBase64,
        maskBase64,
        prompt,
      })

      onResult(result.imageBase64)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }, [canvasManager, prompt, onResult])

  return (
    <div className="space-y-3">
      <Tabs defaultValue="manual">
        <TabsList className="w-full">
          <TabsTrigger value="manual" className="flex-1">
            <Layers className="h-4 w-4 mr-1" />
            Manual Overlay
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1">
            <Wand2 className="h-4 w-4 mr-1" />
            AI Generate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-3 mt-3">
          <p className="text-sm text-muted-foreground">
            Drop a second image. The masked area from the new image will replace
            the masked area in the original.
          </p>
          <DropZone
            onImageLoaded={(img) => handleManualOverlay(img)}
            label="Drop replacement image"
            compact
          />
        </TabsContent>

        <TabsContent value="ai" className="space-y-3 mt-3">
          <p className="text-sm text-muted-foreground">
            Use AI to generate a closed-eyes version. Edit the prompt if needed.
          </p>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want..."
          />
          <Button
            onClick={handleAIGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-sm text-destructive-foreground bg-destructive/20 p-2 rounded">
          {error}
        </p>
      )}
    </div>
  )
}
