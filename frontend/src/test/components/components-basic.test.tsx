import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import DifficultyDots from '../../components/DifficultyDots'
import MatchRing from '../../components/MatchRing'
import ReadinessScore from '../../components/ReadinessScore'
import Alert from '../../components/Alert'
import WorkflowIcon from '../../components/WorkflowIcon'
import WorkflowHeader from '../../components/WorkflowHeader'
import CodeBlock from '../../components/CodeBlock'
import FileReadList from '../../components/FileReadList'
import TechStack from '../../components/TechStack'
import DirectoryMap from '../../components/DirectoryMap'
import TimelineSkeleton from '../../components/TimelineSkeleton'

function renderHeader(props: React.ComponentProps<typeof WorkflowHeader>) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <WorkflowHeader {...props} />
      </AuthProvider>
    </MemoryRouter>
  )
}

// ─── DifficultyDots ───────────────────────────────────────────────────────────

describe('DifficultyDots', () => {
  it('renders 5 dots', () => {
    const { container } = render(<DifficultyDots score={3} />)
    expect(container.querySelectorAll('span')).toHaveLength(5)
  })

  it('aria-label reflects filled count', () => {
    render(<DifficultyDots score={4} />)
    expect(screen.getByLabelText('Difficulty 4 of 5')).toBeInTheDocument()
  })

  it('clamps score above 5', () => {
    render(<DifficultyDots score={10} />)
    expect(screen.getByLabelText('Difficulty 5 of 5')).toBeInTheDocument()
  })

  it('clamps score below 0', () => {
    render(<DifficultyDots score={-3} />)
    expect(screen.getByLabelText('Difficulty 0 of 5')).toBeInTheDocument()
  })
})

// ─── MatchRing ────────────────────────────────────────────────────────────────

describe('MatchRing', () => {
  it('shows percentage in aria-label', () => {
    render(<MatchRing pct={72} />)
    expect(screen.getByLabelText('72% match')).toBeInTheDocument()
  })

  it('displays percentage text inside SVG', () => {
    const { container } = render(<MatchRing pct={85} />)
    expect(container.querySelector('text')?.textContent).toBe('85%')
  })

  it('uses green color for pct >= 75', () => {
    const { container } = render(<MatchRing pct={75} />)
    const circles = container.querySelectorAll('circle')
    expect(circles[1].getAttribute('stroke')).toBe('#3fb950')
  })

  it('uses yellow color for pct >= 50 and < 75', () => {
    const { container } = render(<MatchRing pct={60} />)
    const circles = container.querySelectorAll('circle')
    expect(circles[1].getAttribute('stroke')).toBe('#d29922')
  })

  it('uses grey color for pct < 50', () => {
    const { container } = render(<MatchRing pct={30} />)
    const circles = container.querySelectorAll('circle')
    expect(circles[1].getAttribute('stroke')).toBe('#8b949e')
  })
})

// ─── ReadinessScore ───────────────────────────────────────────────────────────

describe('ReadinessScore', () => {
  const dims = [
    { label: 'Code Understanding', score: 70 },
    { label: 'Testing Knowledge', score: 100 },
    { label: 'Issue Understanding', score: 30 },
  ]

  it('renders all dimension labels', () => {
    render(<ReadinessScore dimensions={dims} overall={67} />)
    expect(screen.getByText('Code Understanding')).toBeInTheDocument()
    expect(screen.getByText('Testing Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Issue Understanding')).toBeInTheDocument()
  })

  it('renders overall score', () => {
    render(<ReadinessScore dimensions={dims} overall={67} />)
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('renders score percentage for each dimension', () => {
    render(<ReadinessScore dimensions={dims} overall={67} />)
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('applies green bar for score >= 75', () => {
    const { container } = render(<ReadinessScore dimensions={[{ label: 'A', score: 80 }]} overall={80} />)
    const bars = container.querySelectorAll('[style*="background"]')
    const greenBar = Array.from(bars).find(el =>
      (el as HTMLElement).style.background?.includes('#3fb950')
    )
    expect(greenBar).toBeTruthy()
  })
})

// ─── Alert ────────────────────────────────────────────────────────────────────

describe('Alert', () => {
  it('renders error message', () => {
    render(<Alert message="Something went wrong" variant="error" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders info message', () => {
    render(<Alert message="Just so you know" variant="info" />)
    expect(screen.getByText('Just so you know')).toBeInTheDocument()
  })

  it('renders success message', () => {
    render(<Alert message="All good!" variant="success" />)
    expect(screen.getByText('All good!')).toBeInTheDocument()
  })

  it('applies correct variant class', () => {
    const { container } = render(<Alert message="test" variant="error" />)
    expect(container.firstChild).toHaveClass('alert-error')
  })
})

// ─── WorkflowIcon ─────────────────────────────────────────────────────────────

describe('WorkflowIcon', () => {
  it('renders an SVG for every valid icon name', () => {
    const names = ['cube', 'arrow', 'code', 'folder', 'stack', 'check', 'clock'] as const
    names.forEach(name => {
      const { container } = render(<WorkflowIcon name={name} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
      expect(container.querySelector('path')).toBeInTheDocument()
    })
  })

  it('is aria-hidden', () => {
    const { container } = render(<WorkflowIcon name="cube" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

// ─── WorkflowHeader ───────────────────────────────────────────────────────────

describe('WorkflowHeader', () => {
  it('renders title and subtitle', () => {
    renderHeader({ title: 'Overview', subtitle: 'Understand the project', step: 1 })
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Understand the project')).toBeInTheDocument()
  })

  it('renders step badge', () => {
    renderHeader({ title: 'T', subtitle: 'S', step: 3 })
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument()
  })

  it('shows analysis complete badge when complete=true', () => {
    renderHeader({ title: 'T', subtitle: 'S', step: 5, complete: true })
    expect(screen.getByText('Analysis complete')).toBeInTheDocument()
  })

  it('does not show analysis complete badge by default', () => {
    renderHeader({ title: 'T', subtitle: 'S', step: 1 })
    expect(screen.queryByText('Analysis complete')).not.toBeInTheDocument()
  })
})

// ─── CodeBlock ────────────────────────────────────────────────────────────────

describe('CodeBlock', () => {
  it('returns null when commands is empty', () => {
    const { container } = render(<CodeBlock commands={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders commands joined by newline', () => {
    const { container } = render(<CodeBlock commands={['git clone repo', 'npm install']} />)
    expect(container.querySelector('code')?.textContent).toBe('git clone repo\nnpm install')
  })
})

// ─── FileReadList ─────────────────────────────────────────────────────────────

describe('FileReadList', () => {
  it('returns null when files is empty', () => {
    const { container } = render(<FileReadList files={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders file paths and purposes', () => {
    render(<FileReadList files={[{ path: 'README.md', purpose: 'Project overview' }]} />)
    expect(screen.getByText('README.md')).toBeInTheDocument()
    expect(screen.getByText('Project overview')).toBeInTheDocument()
  })

  it('renders multiple files', () => {
    render(<FileReadList files={[
      { path: 'src/main.py', purpose: 'Entry point' },
      { path: 'tests/test_main.py', purpose: 'Tests' },
    ]} />)
    expect(screen.getByText('src/main.py')).toBeInTheDocument()
    expect(screen.getByText('tests/test_main.py')).toBeInTheDocument()
  })
})

// ─── TechStack ────────────────────────────────────────────────────────────────

describe('TechStack', () => {
  it('renders each tech item', () => {
    render(<TechStack stack={['Python', 'Docker', 'TypeScript']} />)
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Docker')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('shows empty message when stack is empty', () => {
    render(<TechStack stack={[]} />)
    expect(screen.getByText(/No supported technology manifests/i)).toBeInTheDocument()
  })
})

// ─── DirectoryMap ─────────────────────────────────────────────────────────────

describe('DirectoryMap', () => {
  it('renders directories and descriptions', () => {
    render(<DirectoryMap directories={[
      { directory: '/src', description: 'Application source code' },
      { directory: '/tests', description: 'Test suite' },
    ]} />)
    expect(screen.getByText('/src')).toBeInTheDocument()
    expect(screen.getByText('Application source code')).toBeInTheDocument()
    expect(screen.getByText('/tests')).toBeInTheDocument()
  })

  it('shows empty message when no directories', () => {
    render(<DirectoryMap directories={[]} />)
    expect(screen.getByText(/No directory map is available/i)).toBeInTheDocument()
  })
})

// ─── TimelineSkeleton ─────────────────────────────────────────────────────────

describe('TimelineSkeleton', () => {
  it('renders default 5 skeleton rows', () => {
    const { container } = render(<TimelineSkeleton />)
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(5)
  })

  it('renders custom number of rows', () => {
    const { container } = render(<TimelineSkeleton rows={3} />)
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(3)
  })

  it('is aria-hidden', () => {
    const { container } = render(<TimelineSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
