import { PenLine, Library, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NavbarProps {
  onSettingsClick: () => void
}

export function Navbar({ onSettingsClick }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <PenLine className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold font-serif text-foreground">
            IELTS Writing Lab
          </span>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
              )
            }
          >
            <PenLine className="h-4 w-4" />
            Practice
          </NavLink>
          <NavLink
            to="/collections"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
              )
            }
          >
            <Library className="h-4 w-4" />
            My Collections
          </NavLink>
          <button
            onClick={onSettingsClick}
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  )
}
