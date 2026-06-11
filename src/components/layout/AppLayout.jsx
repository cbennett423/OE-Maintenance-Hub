import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileDrawer from './MobileDrawer'

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Desktop sidebar visibility — collapsible so the user can reclaim
  // horizontal space. Remembered across sessions.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const v = localStorage.getItem('sidebarOpen')
    return v === null ? true : v === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(sidebarOpen))
  }, [sidebarOpen])

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={!sidebarOpen} />
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onMenuClick={() => setDrawerOpen(true)}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
