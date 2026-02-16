import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, LogOut, Paintbrush, Images } from 'lucide-react'
import { getPassword, clearPassword } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'

export default function Header() {
  const navigate = useNavigate()
  const isAuthenticated = typeof window !== 'undefined' && !!getPassword()

  const handleLogout = () => {
    clearPassword()
    navigate({ to: '/' })
  }

  return (
    <header className="border-b border-border bg-card px-4 py-2 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">inpaint-eyes</span>
      </Link>

      {isAuthenticated && (
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/editor">
              <Paintbrush className="h-4 w-4 mr-1" />
              Editor
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/gallery">
              <Images className="h-4 w-4 mr-1" />
              Gallery
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </header>
  )
}
