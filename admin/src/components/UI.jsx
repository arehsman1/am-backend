import { X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

export function StatCard({ label, value, icon: Icon, color = 'accent', sub }) {
  const colors = {
    accent:  'bg-accent/10  text-accent  border-accent/20',
    success: 'bg-success/10 text-success border-success/20',
    danger:  'bg-danger/10  text-danger  border-danger/20',
    warn:    'bg-warn/10    text-warn    border-warn/20',
    info:    'bg-info/10    text-info    border-info/20',
  }
  return (
    <div className="card p-5 flex flex-col gap-3 hover:border-accent/20 transition-all">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-white">{value ?? '—'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export function Table({ columns, data, loading, emptyMessage = 'No data found' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-base-100">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                Loading...
              </div>
            </td></tr>
          ) : !data.length ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">{emptyMessage}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i} className="border-b border-surface-border/50 hover:bg-surface-light/50 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`card w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border flex-shrink-0">
          <h3 className="font-display font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title, message, danger = false, loading = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${danger ? 'bg-danger/10' : 'bg-warn/10'}`}>
          <AlertTriangle size={22} className={danger ? 'text-danger' : 'text-warn'} />
        </div>
        <div className="text-center">
          <h3 className="font-display font-bold text-white">{title}</h3>
          <p className="text-sm text-gray-400 mt-1">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`}>
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Pagination({ page, pages, total, limit, onPage }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between px-1 pt-4">
      <p className="text-xs text-gray-500">
        Showing {Math.min((page-1)*limit+1, total)}–{Math.min(page*limit, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page-1)} disabled={page===1}
          className="w-8 h-8 rounded-lg bg-surface-light border border-surface-border flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft size={14} />
        </button>
        {[...Array(Math.min(5,pages))].map((_,i) => {
          const p = i+1
          return (
            <button key={p} onClick={() => onPage(p)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p===page ? 'bg-accent text-black' : 'bg-surface-light border border-surface-border text-gray-400 hover:text-white'}`}>
              {p}
            </button>
          )
        })}
        <button onClick={() => onPage(page+1)} disabled={page===pages}
          className="w-8 h-8 rounded-lg bg-surface-light border border-surface-border flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="font-display font-bold text-lg text-white">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
