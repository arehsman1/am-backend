import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Media from './pages/Media'
import Reports from './pages/Reports'
import Support from './pages/Support'
import Promotions from './pages/Promotions'
import Wallets from './pages/Wallets'

const Protected = ({ children }) => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const AppRoutes = () => {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index        element={<Dashboard />} />
        <Route path="users"      element={<Users />} />
        <Route path="media"      element={<Media />} />
        <Route path="reports"    element={<Reports />} />
        <Route path="support"    element={<Support />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="wallets"    element={<Wallets />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>
}
