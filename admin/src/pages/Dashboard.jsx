import { useEffect, useState } from 'react'
import { Users, Image, Flag, HeadphonesIcon, Crown, ShieldCheck, UserX, Clock } from 'lucide-react'
import { StatCard } from '../components/UI'
import api from '../api/axios'

export default function Dashboard() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const u = stats?.users   || {}
  const m = stats?.media   || {}
  const r = stats?.reports || {}
  const p = stats?.promotion_requests || {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-lg text-white mb-1">Welcome back</h2>
        <p className="text-sm text-gray-400">Here's what's happening on your platform today.</p>
      </div>

      {/* User stats */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Users</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users"      value={loading ? '...' : u.total}      icon={Users}       color="accent" />
          <StatCard label="Verified"         value={loading ? '...' : u.verified}   icon={ShieldCheck} color="success" />
          <StatCard label="Unverified"       value={loading ? '...' : u.unverified} icon={Clock}       color="warn" />
          <StatCard label="Banned"           value={loading ? '...' : u.banned}     icon={UserX}       color="danger" />
        </div>
      </div>

      {/* Role breakdown */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Roles</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Regular Users',  value: u.by_role?.user,      color: 'text-gray-300' },
            { label: 'Moderators',     value: u.by_role?.moderator,  color: 'text-info' },
            { label: 'Admins',         value: u.by_role?.admin,      color: 'text-accent' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`text-3xl font-display font-bold ${s.color}`}>{loading ? '...' : (s.value ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Operations */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Operations</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Media Pending"     value={loading ? '...' : m.pending}  icon={Image}           color="warn"    sub="Awaiting review" />
          <StatCard label="Open Reports"      value={loading ? '...' : r.open}     icon={Flag}            color="danger"  sub="Needs action" />
          <StatCard label="Pending Promotions"value={loading ? '...' : p.pending}  icon={Crown}           color="info"    sub="Awaiting owner" />
          <StatCard label="Media Approved"    value={loading ? '...' : m.approved} icon={ShieldCheck}     color="success" />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Review Pending Media',     href: '/media',      color: 'bg-warn/10 border-warn/20 text-warn' },
          { label: 'Handle Open Reports',      href: '/reports',    color: 'bg-danger/10 border-danger/20 text-danger' },
          { label: 'Approve Promotions',       href: '/promotions', color: 'bg-info/10 border-info/20 text-info' },
          { label: 'Manage Users',             href: '/users',      color: 'bg-accent/10 border-accent/20 text-accent' },
          { label: 'Support Tickets',          href: '/support',    color: 'bg-success/10 border-success/20 text-success' },
          { label: 'View Wallets',             href: '/wallets',    color: 'bg-surface-light border-surface-border text-gray-300' },
        ].map(l => (
          <a key={l.label} href={l.href} className={`card p-4 border text-sm font-medium text-center rounded-xl hover:opacity-80 transition-opacity ${l.color}`}>
            {l.label}
          </a>
        ))}
      </div>
    </div>
  )
}
