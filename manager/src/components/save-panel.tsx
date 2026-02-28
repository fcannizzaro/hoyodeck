import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Loader2 } from 'lucide-react'
import { client } from '@/orpc/client'

interface SavePanelProps {
  resultBase64: string
  originalImage: HTMLImageElement
}

const NAME_REGEX = /^[a-z0-9-]+$/

export function SavePanel({ resultBase64, originalImage }: SavePanelProps) {
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidName = name.length > 0 && NAME_REGEX.test(name)

  const handleSave = useCallback(async () => {
    if (!isValidName) return

    setIsSaving(true)
    setError(null)

    try {
      const result = await client.saveAvatar({
        name,
        imageBase64: resultBase64,
      })

      setSaved(true)

      if (result.overwritten) {
        setError(`Note: "${name}.png" was overwritten.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [name, resultBase64, isValidName])

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Result Preview</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Original</p>
          <img
            src={originalImage.src}
            alt="Original"
            className="rounded-lg border border-border max-h-48 object-contain w-full"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Result</p>
          <img
            src={`data:image/png;base64,${resultBase64}`}
            alt="Result"
            className="rounded-lg border border-border max-h-48 object-contain w-full"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="character-name">Character Name</Label>
        <Input
          id="character-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            setSaved(false)
          }}
          placeholder="e.g. furina, raiden-shogun"
          disabled={saved}
        />
        {name.length > 0 && !isValidName && (
          <p className="text-xs text-destructive-foreground">
            Use only lowercase letters, numbers, and hyphens
          </p>
        )}
      </div>

      <Button
        onClick={handleSave}
        disabled={!isValidName || isSaving || saved}
        className="w-full"
      >
        {saved ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Saved as {name}.png
          </>
        ) : isSaving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Approve & Save'
        )}
      </Button>

      {error && (
        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
          {error}
        </p>
      )}
    </div>
  )
}
