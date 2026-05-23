import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Eye, RefreshCw, AlertTriangle } from 'lucide-react'
import { Table, Modal, Confirm, Pagination, SectionHeader } from '../components/UI'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function Media() {
  const [media, setMedia]     = useState([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, type: '', item: null })
  const [busy, setBusy]       = useState(false)

  const fetchMedia = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/media/admin/pending', { params: { page, limit: 20 } })
      setMedia(data.data.media)
      setTotal(data.data.pagination.total)
      setPages(data.data.pagination.pages)
    } catch { toast.error('Failed to load media') }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchMedia() }, [fetchMedia])

  const approve = async (id) => {
    try {
      await api.patch(`/media/admin/${id}/approve`)
      toast.success('Media approved')
      fetchMedia()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
  }

  const reject = async () => {
    setBusy(true)
    try {
      await api.patch(`/media/admin/${confirm.item.id}/reject`)
      toast.success('Media rejected and deleted')
      setConfirm({ open: false })
      fetchMedia()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }

  const columns = [
    { key: 'profiles', label: 'Uploader', render: (v, r) => (
      <div>
        <p className="text-white font-medium">{r.profiles?.full_name || '—'}</p>
        <p className="text-gray-500 text-xs">{r.profiles?.email}</p>
      </div>
    )},
    { key: 'type',       label: 'Type',   render: v => <span className={`badge-${v === 'image' ? 'info' : 'warn'}`}>{v}</span> },
    { key: 'mimetype',   label: 'Format', render: v => <span className="font-mono text-xs text-gray-400">{v}</span> },
    { key: 'size_bytes', label: 'Size',   render: v => v ? `${(v/1024/1024).toFixed(1)} MB` : '—' },
    { key: 'created_at', label: 'Uploaded', render: v => v ? format(new Date(v), 'dd MMM yy HH:mm') : '—' },
    { key: 'id',         label: 'Actions', render: (_, row) => (
      <div className="flex items-center gap-1.5">
        <button onClick={() => setPreview(row)} className="p-1.5 text-gray-400 hover:text-accent transition-colors" title="Preview"><Eye size={14} /></button>
        <button onClick={() => approve(row.id)} className="p-1.5 text-gray-400 hover:text-success transition-colors" title="Approve"><CheckCircle size={14} /></button>
        <button onClick={() => setConfirm({ open: true, type: 'reject', item: row })} className="p-1.5 text-gray-400 hover:text-danger transition-colors" title="Reject"><XCircle size={14} /></button>
      </div>
    )},
  ]

  return (
    <div>
      <SectionHeader title="Media Moderation" subtitle={`${total} files pending review`}
        action={<button onClick={fetchMedia} className="btn-ghost flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>} />

      <div className="flex items-center gap-3 bg-warn/10 border border-warn/20 rounded-xl px-4 py-3 mb-5">
        <AlertTriangle size={16} className="text-warn flex-shrink-0" />
        <p className="text-xs text-warn">
          All uploads start as <strong>pending</strong>. Only approved media is visible to users.
          Rejecting a file <strong>permanently deletes</strong> it from storage and the database.
        </p>
      </div>

      <div className="card">
        <Table columns={columns} data={media} loading={loading} emptyMessage="No pending media — you're all caught up!" />
        <div className="px-4 pb-4"><Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} /></div>
      </div>

      {/* Preview Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Media Preview" size="md">
        {preview && (
          <div className="space-y-4">
            {preview.url
              ? preview.type === 'image'
                ? <img src={preview.url} className="w-full rounded-xl max-h-72 object-cover" alt="preview" />
                : <video src={preview.url} controls className="w-full rounded-xl max-h-72 bg-black" />
              : <div className="w-full h-40 bg-base-100 rounded-xl flex items-center justify-center text-gray-500 text-sm">No preview available</div>
            }
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Uploader', preview.profiles?.full_name], ['Type', preview.type],
                ['Size', preview.size_bytes ? `${(preview.size_bytes/1024/1024).toFixed(1)} MB` : '—'],
                ['Uploaded', preview.created_at ? format(new Date(preview.created_at), 'dd MMM yyyy') : '—'],
              ].map(([label, val]) => (
                <div key={label} className="bg-base-100 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm text-white font-medium">{val ?? '—'}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { approve(preview.id); setPreview(null) }} className="btn-primary flex-1 flex items-center justify-center gap-2"><CheckCircle size={14} /> Approve</button>
              <button onClick={() => { setPreview(null); setConfirm({ open: true, type: 'reject', item: preview }) }} className="btn-danger flex-1 flex items-center justify-center gap-2"><XCircle size={14} /> Reject</button>
            </div>
          </div>
        )}
      </Modal>

      <Confirm open={confirm.open} onClose={() => setConfirm({ open: false })} onConfirm={reject} loading={busy} danger
        title="Reject & Delete Media?"
        message="This will permanently delete the file from storage and the database. This cannot be undone." />
    </div>
  )
}
