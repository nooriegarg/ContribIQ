import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import OnboardingPage from './pages/OnboardingPage'
import OnboardingSetupPage from './pages/OnboardingSetupPage'
import ProfilePage from './pages/ProfilePage'
import UserProfilePage from './pages/UserProfilePage'
import LoginPage from './pages/LoginPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import OverviewPage from './pages/OverviewPage'
import WorkflowLayout from './components/WorkflowLayout'
import IssuesPage from './pages/IssuesPage'
import IssueDetailPage from './pages/IssueDetailPage'
import RepoPRsPage from './pages/RepoPRsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/onboarding-setup" element={<OnboardingSetupPage />} />
      <Route path="/profile" element={<UserProfilePage />} />
      <Route element={<WorkflowLayout hero />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="/overview/:taskId" element={<WorkflowLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="issues/:issueNumber" element={<IssueDetailPage />} />
        <Route path="prs" element={<RepoPRsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
