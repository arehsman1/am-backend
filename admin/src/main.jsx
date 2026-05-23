import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" toastOptions={{
        style: { background:'#1e2230', color:'#fff', border:'1px solid #2e3347', fontFamily:'DM Sans, sans-serif', fontSize:'14px' },
        success: { iconTheme: { primary:'#22c55e', secondary:'#0b0e14' } },
        error:   { iconTheme: { primary:'#ef4444', secondary:'#0b0e14' } },
      }} />
    </BrowserRouter>
  </React.StrictMode>
)
