import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  onImageLoaded: (img: HTMLImageElement, file: File) => void
  label?: string
  className?: string
  compact?: boolean
}

export function DropZone({
  onImageLoaded,
  label = 'Drop an image here or click to browse',
  className,
  compact = false,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return

      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        setPreview(url)
        onImageLoaded(img, file)
      }
      img.src = url
    },
    [onImageLoaded],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const onClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) handleFile(file)
    }
    input.click()
  }, [handleFile])

  if (preview) {
    return (
      <div className={cn('relative group cursor-pointer', className)} onClick={onClick}>
        <img
          src={preview}
          alt="Preview"
          className={cn(
            'rounded-lg border border-border object-contain',
            compact ? 'max-h-32' : 'max-h-48',
          )}
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
          <p className="text-white text-sm">Click to replace</p>
        </div>
      </div>
    )
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={cn(
        'border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
        isDragging
          ? 'border-primary bg-primary/10'
          : 'border-muted-foreground/25 hover:border-primary/50',
        compact ? 'p-4' : 'p-8',
        className,
      )}
    >
      <Upload className={cn('text-muted-foreground', compact ? 'h-6 w-6' : 'h-10 w-10')} />
      <p className={cn('text-muted-foreground text-center', compact ? 'text-xs' : 'text-sm')}>
        {label}
      </p>
    </div>
  )
}
