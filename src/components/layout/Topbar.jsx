import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function Topbar() {
  const { user, signOut } = useAuth()

  return (
    <header className="h-14 bg-black-soft border-b-3 border-b-cat-yellow flex items-center justify-between px-5 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <span className="font-display text-sm font-bold uppercase tracking-wider text-muted">
          OE Construction Corp
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted">{user?.email}</span>
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
