import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Table, Modal, Pagination, SectionHeader } from '../components/UI'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const ACTIONS = [
  { value: 'warn',           label: 'Warn User' },
  { value: 'ban',            label: 'Ban User' },
  { value: 'delete_content', label: 'Delete Content' },
  { value: 'close',          label: 'Close Report' },
]

export default function Reports() {
  const [reports, setReports]   = useState([])
  const [total, setTotal]       = useState(0)
  const [pages, setPages]       = useState(1)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatus] = useState('open')
  const [actionModal, setActionModal] = useState({ open: false, report: null })
  const [action, setAction]     = useState('close')
  const [note, setNote]         = useState('')
  const [busy, setBusy]         = useState(false)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/reports', { params })
      setReports(data.data.reports)
      setTotal(data.data.pagination.total)
      setPages(data.data.pagination.pages)
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  const submitAction = async () => {
    setBusy(true)
    try {
      await api.patch(`/reports/${actionModal.report.id}/action`, { action, admin_note: note })
      toast.success(`Report ${action === 'close' ? 'closed' : 'resolved'}`)
      setActionModal({ open: false }); setNote('')
      fetchReports()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }

  const reasonBadge = (r) => {
    const map = { harassment:'danger', fake_profile:'warn', spam:'info', inappropriate_content:'danger', scam:'warn', other:'muted' }
    return <span className={`badge-${map[r] || 'muted'}`}>{r?.replace('_',' ')}</span>
  }

  const columns = [
    { key: 'reporter',        label: 'Reporter', render: v => <span className="text-white">{v?.full_name || v?.email || '—'}</span> },
    { key: 'reported',        label: 'Reported', render: v => <span className="text-white">{v?.full_name || v?.email || '—'}</span> },
    { key: 'reason',          label: 'Reason',   render: v => reasonBadge(v) },
    { key: 'status',          label: 'Status',   render: v => <span className={`badge-${v==='open'?'warn':v==='resolved'?'success':'muted'}`}>{v}</span> },
    { key: 'created_at',      label: 'Date',     render: v => v ? format(new Date(v), 'dd MMM yy') : '—' },
    { key: 'id',              label: 'Actions',  render: (_, row) => (
      row.status === 'open' && (
        <button onClick={() => { setActionModal({ open: true, report: row }); setAction('close'); setNote('') }}
          className="text-xs text-accent hover:text-accent-muted transition-colors">Action</button>
      )
    )},
  ]

  return (
    <div>
      <SectionHeader title="Reports" subtitle={`${total} total reports`}
        action={<button onClick={fetchReports} className="btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>} />

      <div className="flex gap-1 mb-5 bg-base-100 p-1 rounded-lg w-fit border border-surface-border">
        {['open','resolved','closed'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${statusFilter===s?'bg-accent text-black':'text-gray-400 hover:text-white'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        <Table columns={columns} data={reports} loading={loading} emptyMessage="No reports found" />
        <div className="px-4 pb-4"><Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} /></div>
      </div>

      <Modal open={actionModal.open} onClose={() => setActionModal({ open: false })} title="Action Report" size="sm">
        {actionModal.report && (
          <div className="space-y-4">
            <div className="bg-base-100 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-400">Reported:</span><span className="text-white">{actionModal.report.reported?.full_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Reason:</span>{reasonBadge(actionModal.report.reason)}</div>
              {actionModal.report.description && <p className="text-gray-400 text-xs">{actionModal.report.description}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Action</label>
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map(a => (
                  <button key={a.value} onClick={() => setAction(a.value)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${action===a.value?'bg-accent/20 text-accent border-accent/40':'bg-surface-light text-gray-400 border-surface-border hover:text-white'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Admin Note (optional)</label>
              <textarea className="input w-full h-20 resize-none text-xs" placeholder="Add a note..."
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActionModal({ open: false })} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submitAction} disabled={busy} className="btn-primary flex-1">{busy ? 'Saving...' : 'Submit'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
