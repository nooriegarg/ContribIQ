import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/overview/:taskId" element={<OverviewPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
