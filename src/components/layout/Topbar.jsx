import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Topbar({ onMenuClick }) {
  const { user, signOut } = useAuth()

  return (
    <header className="h-14 bg-black-soft border-b-3 border-b-cat-yellow flex items-center justify-between px-4 md:px-5 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden text-muted hover:text-text transition-colors p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <span className="font-display text-sm font-bold uppercase tracking-wider text-muted">
          OE Construction Corp
        </span>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <span className="hidden sm:inline text-sm text-muted truncate max-w-[180px]">
          {user?.email}
        </span>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
