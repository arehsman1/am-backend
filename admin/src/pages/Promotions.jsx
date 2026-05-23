import { useEffect, useState, useCallback } from 'react'
import { Crown, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { Table, Confirm, SectionHeader } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function Promotions() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [confirm, setConfirm]   = useState({ open: false, type: '', item: null })
  const [busy, setBusy]         = useState(false)

  const isOwner = user?.role === 'owner'

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/promotion-requests')
      setRequests(data.data || [])
    } catch { toast.error('Failed to load promotion requests') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleAction = async () => {
    const { type, item } = confirm
    setBusy(true)
    try {
      if (type === 'approve') {
        await api.patch(`/admin/promotion-requests/${item.id}/approve`)
        toast.success(`${item.target?.full_name || 'User'} promoted to admin`)
      } else {
        await api.patch(`/admin/promotion-requests/${item.id}/reject`)
        toast.success('Request rejected and deleted')
      }
      setConfirm({ open: false })
      fetchRequests()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed')
    } finally { setBusy(false) }
  }

  const columns = [
    { key: 'requester',    label: 'Requested By', render: v => (
      <div>
        <p className="text-white font-medium">{v?.full_name || '—'}</p>
        <p className="text-gray-500 text-xs">{v?.email}</p>
      </div>
    )},
    { key: 'target',       label: 'Promote',      render: v => (
      <div>
        <p className="text-white font-medium">{v?.full_name || '—'}</p>
        <p className="text-gray-500 text-xs">{v?.email}</p>
        <span className="badge-muted text-xs capitalize mt-0.5 inline-block">{v?.role}</span>
      </div>
    )},
    { key: 'reason',       label: 'Reason',       render: v => <span className="text-gray-400 text-xs">{v || '—'}</span> },
    { key: 'created_at',   label: 'Submitted',    render: v => v ? format(new Date(v), 'dd MMM yy') : '—' },
    { key: 'id',           label: 'Actions',      render: (_, row) => (
      isOwner ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setConfirm({ open: true, type: 'approve', item: row })}
            className="p-1.5 text-gray-400 hover:text-success transition-colors" title="Approve">
            <CheckCircle size={14} />
          </button>
          <button
            onClick={() => setConfirm({ open: true, type: 'reject', item: row })}
            className="p-1.5 text-gray-400 hover:text-danger transition-colors" title="Reject">
            <XCircle size={14} />
          </button>
        </div>
      ) : (
        <span className="text-xs text-gray-500">Owner only</span>
      )
    )},
  ]

  return (
    <div>
      <SectionHeader
        title="Admin Promotion Requests"
        subtitle="Admins submit these; only the owner can approve or reject"
        action={
          <button onClick={fetchRequests} className="btn-ghost flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {!isOwner && (
        <div className="flex items-center gap-3 bg-info/10 border border-info/20 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle size={16} className="text-info flex-shrink-0" />
          <p className="text-xs text-info">
            You are viewing as <strong>{user?.role}</strong>. Only the <strong>owner</strong> can approve or reject promotion requests.
          </p>
        </div>
      )}

      {isOwner && requests.length > 0 && (
        <div className="flex items-center gap-3 bg-warn/10 border border-warn/20 rounded-xl px-4 py-3 mb-5">
          <Crown size={16} className="text-warn flex-shrink-0" />
          <p className="text-xs text-warn">
            <strong>{requests.length}</strong> pending promotion request{requests.length > 1 ? 's' : ''} awaiting your decision.
            Approved promotions grant <strong>admin</strong> role. Rejected requests are permanently deleted.
          </p>
        </div>
      )}

      <div className="card">
        <Table
          columns={columns}
          data={requests}
          loading={loading}
          emptyMessage="No pending promotion requests"
        />
      </div>

      <Confirm
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={handleAction}
        loading={busy}
        danger={confirm.type === 'reject'}
        title={confirm.type === 'approve' ? 'Approve Promotion?' : 'Reject & Delete Request?'}
        message={
          confirm.type === 'approve'
            ? `Promote ${confirm.item?.target?.full_name || 'this user'} to admin role?`
            : `Reject and permanently delete this promotion request for ${confirm.item?.target?.full_name || 'this user'}?`
        }
      />
    </div>
  )
}
