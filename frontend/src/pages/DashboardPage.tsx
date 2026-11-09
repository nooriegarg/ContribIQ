import { useAuth } from '../context/useAuth'
import BrandLogo from '../components/BrandLogo'

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', padding: '2rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <BrandLogo />
        <button
          onClick={logout}
          style={{
            background: 'transparent',
            border: '1px solid #30363d',
            color: '#8b949e',
            borderRadius: '6px',
            padding: '0.4rem 1rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Sign out
        </button>
      </header>

      <main>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p style={{ color: '#8b949e', marginBottom: '2rem' }}>
          Your ContribIQ dashboard is being built. More features coming soon.
        </p>

        <div style={{
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#8b949e',
        }}>
          Repository analysis features coming in the next release.
        </div>
      </main>
    </div>
  )
}
