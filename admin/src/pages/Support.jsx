import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, MessageSquare } from 'lucide-react'
import { Table, Modal, Pagination, SectionHeader } from '../components/UI'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function Support() {
  const [tickets, setTickets]   = useState([])
  const [total, setTotal]       = useState(0)
  const [pages, setPages]       = useState(1)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatus] = useState('open')
  const [thread, setThread]     = useState(null)
  const [threadData, setThreadData] = useState(null)
  const [reply, setReply]       = useState('')
  const [busy, setBusy]         = useState(false)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/support/admin/tickets', { params })
      setTickets(data.data.tickets)
      setTotal(data.data.pagination.total)
      setPages(data.data.pagination.pages)
    } catch { toast.error('Failed to load tickets') }
    finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const openThread = async (ticket) => {
    setThread(ticket)
    try {
      const { data } = await api.get(`/support/tickets/${ticket.id}`)
      setThreadData(data.data)
    } catch { toast.error('Failed to load thread') }
  }

  const sendReply = async () => {
    if (!reply.trim()) return
    setBusy(true)
    try {
      await api.post(`/support/tickets/${thread.id}/reply`, { message: reply })
      setReply('')
      const { data } = await api.get(`/support/tickets/${thread.id}`)
      setThreadData(data.data)
      toast.success('Reply sent')
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }

  const closeTicket = async (id) => {
    try {
      await api.patch(`/support/admin/tickets/${id}/close`)
      toast.success('Ticket closed')
      setThread(null); setThreadData(null)
      fetchTickets()
    } catch { toast.error('Failed to close') }
  }

  const columns = [
    { key: 'user',       label: 'User',     render: v => <span className="text-white">{v?.full_name || v?.email || '—'}</span> },
    { key: 'subject',    label: 'Subject',  render: v => <span className="text-gray-300">{v}</span> },
    { key: 'status',     label: 'Status',   render: v => <span className={`badge-${v==='open'?'success':'muted'}`}>{v}</span> },
    { key: 'updated_at', label: 'Last Activity', render: v => v ? format(new Date(v), 'dd MMM yy HH:mm') : '—' },
    { key: 'id',         label: 'Actions',  render: (_, row) => (
      <button onClick={() => openThread(row)} className="flex items-center gap-1 text-xs text-accent hover:text-accent-muted transition-colors">
        <MessageSquare size={12} /> View
      </button>
    )},
  ]

  return (
    <div>
      <SectionHeader title="Support Tickets" subtitle={`${total} total tickets`}
        action={<button onClick={fetchTickets} className="btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>} />

      <div className="flex gap-1 mb-5 bg-base-100 p-1 rounded-lg w-fit border border-surface-border">
        {['open','closed'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${statusFilter===s?'bg-accent text-black':'text-gray-400 hover:text-white'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        <Table columns={columns} data={tickets} loading={loading} emptyMessage="No tickets found" />
        <div className="px-4 pb-4"><Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} /></div>
      </div>

      {/* Thread Modal */}
      <Modal open={!!thread} onClose={() => { setThread(null); setThreadData(null) }} title={thread?.subject || 'Support Thread'} size="lg">
        {threadData && (
          <div className="space-y-4">
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {threadData.messages?.map(m => (
                <div key={m.id} className={`flex flex-col gap-1 ${m.sender_role === 'admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${m.sender_role === 'admin' ? 'bg-accent/20 text-white' : 'bg-surface-light text-gray-300'}`}>
                    {m.message}
                  </div>
                  <p className="text-xs text-gray-500">{m.sender?.full_name} · {m.created_at ? format(new Date(m.created_at), 'HH:mm') : ''}</p>
                </div>
              ))}
            </div>
            {thread.status === 'open' && (
              <>
                <textarea className="input w-full h-20 resize-none text-sm" placeholder="Type your reply..."
                  value={reply} onChange={e => setReply(e.target.value)} />
                <div className="flex gap-3">
                  <button onClick={() => closeTicket(thread.id)} className="btn-ghost">Close Ticket</button>
                  <button onClick={sendReply} disabled={busy || !reply.trim()} className="btn-primary flex-1">
                    {busy ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </>
            )}
            {thread.status === 'closed' && <p className="text-center text-gray-500 text-sm">This ticket is closed.</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
