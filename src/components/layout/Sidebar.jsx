import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Truck,
  Wrench,
  ClipboardList,
  Package,
  FileText,
  History,
  Settings,
  HardHat,
  CalendarClock,
  Receipt,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/equipment', label: 'Equipment', icon: HardHat },
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/rentals', label: 'Rentals', icon: CalendarClock },
  { to: '/work-orders', label: 'Work Orders', icon: Wrench },
  { to: '/open-invoices', label: 'Open Invoices', icon: Receipt },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/audit-log', label: 'Audit Log', icon: History, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const { isAdmin } = useAuth()
  const visibleItems = navItems.filter((n) => !n.adminOnly || isAdmin)
  return (
    <aside className="w-[220px] min-h-screen bg-black-soft border-r border-border hidden md:flex flex-col shrink-0">
      <div className="px-5 py-4 border-b border-border">
        <h1 className="font-display text-base font-bold uppercase tracking-widest text-cat-yellow leading-tight">
          OE Maintenance
        </h1>
        <p className="text-[11px] text-muted tracking-wide uppercase">Hub</p>
      </div>

      <nav className="flex-1 py-2">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm font-display font-semibold uppercase tracking-wider transition-colors ${
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
  )
}
