import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, Eye, AlertTriangle } from 'lucide-react'
import { Table, Modal, SectionHeader, Pagination } from '../components/UI'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function Wallets() {
  const [users, setUsers]   = useState([])
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [txModal, setTxModal] = useState({ open: false, userId: null, name: '' })
  const [txns, setTxns]     = useState([])
  const [txLoading, setTxLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      const { data } = await api.get('/users', { params })
      setUsers(data.data.users)
      setTotal(data.data.pagination.total)
      setPages(data.data.pagination.pages)
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const viewTransactions = async (userId, name) => {
    setTxModal({ open: true, userId, name })
    setTxLoading(true)
    setTxns([])
    try {
      // Admin fetches transactions by impersonating — backend needs /admin/wallet/:userId endpoint
      // For now using public endpoint structure; extend backend as needed
      toast('Transaction view requires /admin/wallet/:userId endpoint', { icon: 'ℹ️' })
    } catch { toast.error('Failed to load transactions') }
    finally { setTxLoading(false) }
  }

  const txColumns = [
    { key: 'type',           label: 'Type',    render: v => <span className={`badge-${v==='deposit'?'success':'warn'}`}>{v}</span> },
    { key: 'amount',         label: 'Amount',  render: v => `₦${parseFloat(v || 0).toLocaleString()}` },
    { key: 'status',         label: 'Status',  render: v => <span className={`badge-${v==='success'?'success':v==='pending'?'warn':'danger'}`}>{v}</span> },
    { key: 'balance_after',  label: 'Balance After', render: v => `₦${parseFloat(v || 0).toLocaleString()}` },
    { key: 'description',    label: 'Description' },
    { key: 'created_at',     label: 'Date',    render: v => v ? format(new Date(v), 'dd MMM yy HH:mm') : '—' },
  ]

  const walletColumns = [
    { key: 'full_name',  label: 'User',   render: (v, r) => <span className="text-white font-medium">{v || r.email?.split('@')[0]}</span> },
    { key: 'email',      label: 'Email',  render: v => <span className="text-gray-400 text-xs">{v}</span> },
    { key: 'role',       label: 'Role',   render: v => <span className="badge-muted capitalize">{v}</span> },
    { key: 'is_verified',label: 'Verified', render: v => v ? <span className="badge-success">Yes</span> : <span className="badge-muted">No</span> },
    { key: 'created_at', label: 'Joined', render: v => v ? format(new Date(v), 'dd MMM yy') : '—' },
    { key: 'id',         label: 'Actions', render: (_, row) => (
      <button onClick={() => viewTransactions(row.id, row.full_name || row.email)}
        className="p-1.5 text-gray-400 hover:text-accent transition-colors" title="View Transactions">
        <Eye size={14} />
      </button>
    )},
  ]

  return (
    <div>
      <SectionHeader
        title="Wallet Control"
        subtitle="View user wallets and transaction history"
        action={
          <button onClick={fetchUsers} className="btn-ghost flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      <div className="flex items-center gap-3 bg-warn/10 border border-warn/20 rounded-xl px-4 py-3 mb-5">
        <AlertTriangle size={16} className="text-warn flex-shrink-0" />
        <p className="text-xs text-warn">
          <strong>Rule:</strong> Wallet balances can only be modified through verified Paystack transactions.
          No manual balance edits are permitted.
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9 w-64 text-xs" placeholder="Search user..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card">
        <Table columns={walletColumns} data={users} loading={loading} />
        <div className="px-4 pb-4">
          <Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} />
        </div>
      </div>

      <Modal open={txModal.open} onClose={() => setTxModal({ open: false })} title={`Transactions — ${txModal.name}`} size="xl">
        <Table columns={txColumns} data={txns} loading={txLoading} emptyMessage="No transactions found" />
      </Modal>
    </div>
  )
}
