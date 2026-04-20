import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Truck,
  Wrench,
  Package,
  FileText,
  History,
  Settings,
  HardHat,
  CalendarClock,
  Receipt,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/equipment', label: 'Equipment', icon: HardHat },
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/rentals', label: 'Rentals', icon: CalendarClock },
  { to: '/work-orders', label: 'Work Orders', icon: Wrench },
  { to: '/open-invoices', label: 'Open Invoices', icon: Receipt },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/audit-log', label: 'Audit Log', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileDrawer({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[90] md:hidden bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <aside className="w-[240px] h-full bg-black-soft border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="font-display text-base font-bold uppercase tracking-widest text-cat-yellow leading-tight">
              OE Maintenance
            </h1>
            <p className="text-[11px] text-muted tracking-wide uppercase">Hub</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors p-1"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm font-display font-semibold uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'text-cat-yellow border-l-3 border-l-cat-yellow bg-cat-yellow/5'
                    : 'text-muted hover:text-text border-l-3 border-l-transparent'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  )
}
