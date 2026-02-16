import { useEffect, useRef } from 'react'
import { CanvasManager } from '@/lib/canvas-manager'
import type { ViewState } from '@/lib/canvas-manager'

interface MaskEditorProps {
  image: HTMLImageElement
  onManagerReady: (manager: CanvasManager) => void
  onViewChange?: (view: ViewState) => void
}

export function MaskEditor({ image, onManagerReady, onViewChange }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const managerRef = useRef<CanvasManager | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Clean up previous manager
    if (managerRef.current) {
      managerRef.current.destroy()
    }

    const manager = new CanvasManager(canvas)

    manager.onViewChange = (view) => {
      viewRef.current = view
      // Apply CSS transform for zoom and pan
      canvas.style.transform = `scale(${view.zoom}) translate(${view.panX}px, ${view.panY}px)`
      onViewChange?.(view)
    }

    manager.setImage(image)
    managerRef.current = manager
    onManagerReady(manager)

    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [image, onManagerReady, onViewChange])

  return (
    <div className="flex justify-center">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-border"
      >
        <canvas
          ref={canvasRef}
          className="max-w-full cursor-crosshair origin-center"
          style={{ transformOrigin: 'center center' }}
        />
      </div>
    </div>
  )
}
