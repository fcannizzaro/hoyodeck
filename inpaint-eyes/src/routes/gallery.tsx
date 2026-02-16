import { createFileRoute, redirect } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, ImageOff } from 'lucide-react'
import { getPassword } from '@/lib/auth-store'
import { orpc, client } from '@/orpc/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export const Route = createFileRoute('/gallery')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !getPassword()) {
      throw redirect({ to: '/' })
    }
  },
  component: GalleryPage,
})

function GalleryPage() {
  const queryClient = useQueryClient()
  const queryOptions = orpc.listAvatars.queryOptions({ input: {} })
  const { data: avatars, isLoading } = useQuery(queryOptions)
  const [deletingName, setDeletingName] = useState<string | null>(null)

  const handleDelete = async (name: string) => {
    setDeletingName(name)
    try {
      await client.deleteAvatar({ name })
      queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
    } finally {
      setDeletingName(null)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">Gallery</h1>

        {isLoading && (
          <p className="text-muted-foreground text-sm">Loading avatars...</p>
        )}

        {avatars && avatars.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <ImageOff className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                No avatars yet. Go to the Editor to create one.
              </p>
            </CardContent>
          </Card>
        )}

        {avatars && avatars.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {avatars.map((avatar) => (
              <Card key={avatar.name} className="overflow-hidden group">
                <div className="relative">
                  <img
                    src={avatar.url}
                    alt={avatar.name}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingName === avatar.name}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {avatar.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {avatar.name}.png from
                            the avatars directory.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(avatar.name)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardContent className="p-2">
                  <p className="text-sm font-medium truncate">{avatar.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
