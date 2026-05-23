// Layout.jsx
import { useState } from 'react'
import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { Bell, Search, LayoutDashboard, Users, Image, Flag, HeadphonesIcon, Crown, Wallet, LogOut, Heart, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const nav = [
  { label: 'Dashboard',   path: '/',           icon: LayoutDashboard },
  { label: 'Users',       path: '/users',       icon: Users },
  { label: 'Media',       path: '/media',       icon: Image },
  { label: 'Reports',     path: '/reports',     icon: Flag },
  { label: 'Support',     path: '/support',     icon: HeadphonesIcon },
  { label: 'Promotions',  path: '/promotions',  icon: Crown },
  { label: 'Wallets',     path: '/wallets',     icon: Wallet },
]

const titles = {
  '/': 'Dashboard', '/users': 'User Management', '/media': 'Media Moderation',
  '/reports': 'Reports', '/support': 'Support Tickets',
  '/promotions': 'Admin Promotions', '/wallets': 'Wallets',
}

function Sidebar({ collapsed, setCollapsed }) {
  const { logout, user } = useAuth()
  const location = useLocation()
  return (
    <aside className={`flex flex-col h-screen bg-base-50 border-r border-surface-border transition-all duration-300 fixed left-0 top-0 z-30 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-border min-h-[64px]">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Heart size={16} className="text-black" fill="black" />
        </div>
        {!collapsed && <span className="font-display font-bold text-white text-base leading-none">Match<span className="text-accent">Admin</span></span>}
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-gray-500 hover:text-white">
          <ChevronRight size={16} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map(({ label, path, icon: Icon }) => {
          const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
          return (
            <NavLink key={path} to={path} title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-accent/10 text-accent border border-accent/20' : 'text-gray-400 hover:text-white hover:bg-surface-light'}`}>
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>
      <div className="border-t border-surface-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
              {user?.role?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
        )}
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-danger hover:bg-danger/10 transition-all">
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-base-50 min-h-[64px] flex-shrink-0">
          <div>
            <h1 className="font-display font-bold text-xl text-white">{titles[location.pathname] || 'MatchAdmin'}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9 w-48 text-xs" placeholder="Quick search..." />
            </div>
            <button className="relative w-9 h-9 rounded-lg bg-surface-light border border-surface-border flex items-center justify-center text-gray-400 hover:text-white">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="fade-up"><Outlet /></div>
        </div>
      </main>
    </div>
  )
}
