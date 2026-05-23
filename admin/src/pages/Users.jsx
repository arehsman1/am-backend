import { useEffect, useState, useCallback } from 'react'
import { Search, ShieldCheck, UserX, UserCheck, Eye, RefreshCw } from 'lucide-react'
import { Table, Modal, Confirm, Pagination, SectionHeader } from '../components/UI'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function Users() {
  const [users, setUsers]     = useState([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [roleFilter, setRole] = useState('')
  const [verFilter, setVer]   = useState('')
  const [detail, setDetail]   = useState(null)
  const [confirm, setConfirm] = useState({ open: false, action: null, user: null })
  const [busy, setBusy]       = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search)    params.search       = search
      if (roleFilter) params.role        = roleFilter
      if (verFilter)  params.is_verified = verFilter
      const { data } = await api.get('/users', { params })
      setUsers(data.data.users)
      setTotal(data.data.pagination.total)
      setPages(data.data.pagination.pages)
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }, [page, search, roleFilter, verFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const doAction = async () => {
    const { action, user } = confirm
    setBusy(true)
    try {
      if (action === 'verify')    await api.patch(`/users/${user.id}/verify`, { is_verified: true })
      if (action === 'unverify')  await api.patch(`/users/${user.id}/verify`, { is_verified: false })
      if (action === 'ban')       await api.patch(`/users/${user.id}/ban`,    { banned: true })
      if (action === 'unban')     await api.patch(`/users/${user.id}/ban`,    { banned: false })
      toast.success('Done')
      fetchUsers()
    } catch (e) { toast.error(e.response?.data?.message || 'Action failed') }
    finally { setBusy(false); setConfirm({ open: false }) }
  }

  const roleBadge = (role) => {
    const map = { owner: 'badge-danger', admin: 'badge-warn', moderator: 'badge-info', user: 'badge-muted' }
    return <span className={map[role] || 'badge-muted'}>{role}</span>
  }

  const columns = [
    { key: 'full_name',    label: 'Name',     render: (v, r) => <span className="text-white font-medium">{v || r.email?.split('@')[0]}</span> },
    { key: 'email',        label: 'Email',    render: v => <span className="text-gray-400">{v}</span> },
    { key: 'role',         label: 'Role',     render: v => roleBadge(v) },
    { key: 'is_verified',  label: 'Verified', render: v => v ? <span className="badge-success">Yes</span> : <span className="badge-muted">No</span> },
    { key: 'is_banned',    label: 'Status',   render: v => v ? <span className="badge-danger">Banned</span> : <span className="badge-success">Active</span> },
    { key: 'created_at',   label: 'Joined',   render: v => v ? format(new Date(v), 'dd MMM yy') : '—' },
    { key: 'id',           label: 'Actions',  render: (_, row) => (
      <div className="flex items-center gap-1.5">
        <button onClick={() => setDetail(row)} className="p-1.5 text-gray-400 hover:text-accent transition-colors"><Eye size={14} /></button>
        {row.is_verified
          ? <button onClick={() => setConfirm({ open: true, action: 'unverify', user: row })} className="p-1.5 text-gray-400 hover:text-warn transition-colors" title="Unverify"><ShieldCheck size={14} /></button>
          : <button onClick={() => setConfirm({ open: true, action: 'verify',   user: row })} className="p-1.5 text-gray-400 hover:text-success transition-colors" title="Verify"><ShieldCheck size={14} /></button>
        }
        {row.is_banned
          ? <button onClick={() => setConfirm({ open: true, action: 'unban', user: row })} className="p-1.5 text-gray-400 hover:text-success transition-colors" title="Unban"><UserCheck size={14} /></button>
          : <button onClick={() => setConfirm({ open: true, action: 'ban',   user: row })} className="p-1.5 text-gray-400 hover:text-danger transition-colors" title="Ban"><UserX size={14} /></button>
        }
      </div>
    )},
  ]

  return (
    <div>
      <SectionHeader title="User Management" subtitle={`${total.toLocaleString()} total users`}
        action={<button onClick={fetchUsers} className="btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>} />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9 w-60 text-xs" placeholder="Search name or email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input text-xs" value={roleFilter} onChange={e => { setRole(e.target.value); setPage(1) }}>
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
        <select className="input text-xs" value={verFilter} onChange={e => { setVer(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </div>

      <div className="card">
        <Table columns={columns} data={users} loading={loading} />
        <div className="px-4 pb-4"><Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} /></div>
      </div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="User Detail" size="md">
        {detail && (
          <div className="grid grid-cols-2 gap-3">
            {[['ID', detail.id], ['Email', detail.email], ['Role', detail.role],
              ['Verified', detail.is_verified ? 'Yes' : 'No'], ['Banned', detail.is_banned ? 'Yes' : 'No'],
              ['City', detail.location_city], ['Joined', detail.created_at ? format(new Date(detail.created_at), 'dd MMM yyyy') : '—'],
            ].map(([label, val]) => (
              <div key={label} className="bg-base-100 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm text-white font-medium break-all">{val ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Confirm open={confirm.open} onClose={() => setConfirm({ open: false })} onConfirm={doAction} loading={busy}
        danger={['ban'].includes(confirm.action)}
        title={`${confirm.action?.charAt(0).toUpperCase() + confirm.action?.slice(1)} User?`}
        message={`Are you sure you want to ${confirm.action} ${confirm.user?.email}?`} />
    </div>
  )
}
