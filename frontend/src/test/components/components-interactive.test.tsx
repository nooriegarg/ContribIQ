import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChipSelector from '../../components/ChipSelector'
import Checklist from '../../components/Checklist'
import IssueCard, { type IssueMatch } from '../../components/IssueCard'
import SimilarPRs from '../../components/SimilarPRs'
import ImpactChain from '../../components/ImpactChain'
import GitHubButton from '../../components/GitHubButton'
import IssuePreviewCard from '../../components/IssuePreviewCard'
import RepoStats from '../../components/RepoStats'
import RepoBanner from '../../components/RepoBanner'
import ExperienceSelector from '../../components/ExperienceSelector'

// ─── ChipSelector ─────────────────────────────────────────────────────────────

describe('ChipSelector', () => {
  const options = [
    { value: 'python', label: 'Python' },
    { value: 'ts', label: 'TypeScript' },
    { value: 'go', label: 'Go' },
  ]

  it('renders all options as buttons', () => {
    render(<ChipSelector label="Languages" options={options} selected={[]} onChange={() => {}} />)
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Go')).toBeInTheDocument()
  })

  it('marks selected options as aria-pressed=true', () => {
    render(<ChipSelector label="Languages" options={options} selected={['python']} onChange={() => {}} />)
    expect(screen.getByText('Python').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('TypeScript').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn()
    render(<ChipSelector label="Languages" options={options} selected={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('Go'))
    expect(onChange).toHaveBeenCalledWith('go')
  })

  it('applies sel class to selected chips', () => {
    render(<ChipSelector label="Languages" options={options} selected={['ts']} onChange={() => {}} />)
    expect(screen.getByText('TypeScript').closest('button')).toHaveClass('sel')
    expect(screen.getByText('Python').closest('button')).not.toHaveClass('sel')
  })

  it('has correct role and aria-label on group', () => {
    render(<ChipSelector label="Pick Languages" options={options} selected={[]} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Pick Languages' })).toBeInTheDocument()
  })
})

// ─── Checklist ────────────────────────────────────────────────────────────────

describe('Checklist', () => {
  beforeEach(() => localStorage.clear())

  const items = [
    { step: 'Read the issue' },
    { step: 'Set up locally' },
    { step: 'Open a PR' },
  ]

  it('renders all checklist items', () => {
    render(<Checklist items={items} issueKey="issue-1" />)
    expect(screen.getByText('Read the issue')).toBeInTheDocument()
    expect(screen.getByText('Set up locally')).toBeInTheDocument()
    expect(screen.getByText('Open a PR')).toBeInTheDocument()
  })

  it('shows 0 of N complete initially', () => {
    render(<Checklist items={items} issueKey="issue-1" />)
    expect(screen.getByText('0 of 3 complete')).toBeInTheDocument()
  })

  it('increments count when item is checked', () => {
    render(<Checklist items={items} issueKey="issue-1" />)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getByText('1 of 3 complete')).toBeInTheDocument()
  })

  it('unchecks item on second click', () => {
    render(<Checklist items={items} issueKey="issue-1" />)
    const checkbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(checkbox)
    fireEvent.click(checkbox)
    expect(screen.getByText('0 of 3 complete')).toBeInTheDocument()
  })

  it('persists checked state to localStorage', () => {
    render(<Checklist items={items} issueKey="issue-persist" />)
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    const stored = JSON.parse(localStorage.getItem('checklist:issue-persist') ?? '[]')
    expect(stored).toContain(1)
  })

  it('restores checked state from localStorage', () => {
    localStorage.setItem('checklist:issue-restore', JSON.stringify([0, 2]))
    render(<Checklist items={items} issueKey="issue-restore" />)
    expect(screen.getByText('2 of 3 complete')).toBeInTheDocument()
  })
})

// ─── IssueCard ────────────────────────────────────────────────────────────────

const sampleIssue: IssueMatch = {
  issue_id: 'abc-123',
  match_pct: 85,
  reasons: ['Matches your Python skills', 'Good first issue', 'Small scope'],
  title: 'Fix login timeout',
  number: 42,
  url: 'https://github.com/owner/repo/issues/42',
  difficulty: 2,
  labels: ['bug', 'good first issue'],
}

describe('IssueCard', () => {
  it('renders issue title', () => {
    render(<IssueCard issue={sampleIssue} />)
    expect(screen.getByText('Fix login timeout')).toBeInTheDocument()
  })

  it('renders issue number', () => {
    render(<IssueCard issue={sampleIssue} />)
    expect(screen.getByText('#42')).toBeInTheDocument()
  })

  it('renders all labels', () => {
    render(<IssueCard issue={sampleIssue} />)
    expect(screen.getByText('bug')).toBeInTheDocument()
    expect(screen.getByText('good first issue')).toBeInTheDocument()
  })

  it('renders all reasons', () => {
    render(<IssueCard issue={sampleIssue} />)
    expect(screen.getByText('Matches your Python skills')).toBeInTheDocument()
    expect(screen.getByText('Good first issue')).toBeInTheDocument()
    expect(screen.getByText('Small scope')).toBeInTheDocument()
  })

  it('shows Best match badge when isBest=true', () => {
    render(<IssueCard issue={sampleIssue} isBest />)
    expect(screen.getByText('Best match')).toBeInTheDocument()
  })

  it('does not show Best match badge by default', () => {
    render(<IssueCard issue={sampleIssue} />)
    expect(screen.queryByText('Best match')).not.toBeInTheDocument()
  })

  it('renders title as link when url is provided', () => {
    render(<IssueCard issue={sampleIssue} />)
    const link = screen.getByRole('link', { name: 'Fix login timeout' })
    expect(link).toHaveAttribute('href', sampleIssue.url!)
  })

  it('renders title as plain text when url is null', () => {
    render(<IssueCard issue={{ ...sampleIssue, url: null }} />)
    expect(screen.queryByRole('link', { name: 'Fix login timeout' })).not.toBeInTheDocument()
    expect(screen.getByText('Fix login timeout')).toBeInTheDocument()
  })
})

// ─── SimilarPRs ───────────────────────────────────────────────────────────────

describe('SimilarPRs', () => {
  it('shows empty message when no PRs', () => {
    render(<SimilarPRs prs={[]} />)
    expect(screen.getByText(/No similar pull requests found/i)).toBeInTheDocument()
  })

  it('renders PR number and title', () => {
    render(<SimilarPRs prs={[{ number: 10, title: 'Fix auth', url: 'https://github.com/pr/10' }]} />)
    expect(screen.getByText('#10')).toBeInTheDocument()
    expect(screen.getByText('Fix auth')).toBeInTheDocument()
  })

  it('renders PR title as link when url is provided', () => {
    render(<SimilarPRs prs={[{ number: 10, title: 'Fix auth', url: 'https://github.com/pr/10' }]} />)
    expect(screen.getByRole('link', { name: 'Fix auth' })).toHaveAttribute('href', 'https://github.com/pr/10')
  })

  it('renders PR title as plain text when url is null', () => {
    render(<SimilarPRs prs={[{ number: 10, title: 'Fix auth', url: null }]} />)
    expect(screen.queryByRole('link', { name: 'Fix auth' })).not.toBeInTheDocument()
    expect(screen.getByText('Fix auth')).toBeInTheDocument()
  })

  it('renders multiple PRs', () => {
    render(<SimilarPRs prs={[
      { number: 1, title: 'PR one', url: null },
      { number: 2, title: 'PR two', url: null },
    ]} />)
    expect(screen.getByText('PR one')).toBeInTheDocument()
    expect(screen.getByText('PR two')).toBeInTheDocument()
  })
})

// ─── ImpactChain ──────────────────────────────────────────────────────────────

describe('ImpactChain', () => {
  it('renders nothing when components is empty', () => {
    const { container } = render(<ImpactChain components={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders each component name', () => {
    render(<ImpactChain components={['API', 'AuthService', 'Database']} />)
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('AuthService')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
  })

  it('renders connector lines between items (N-1 connectors for N items)', () => {
    const { container } = render(<ImpactChain components={['A', 'B', 'C']} />)
    // connector divs have fixed height:16 style
    const connectors = Array.from(container.querySelectorAll('div')).filter(
      el => el.style.height === '16px'
    )
    expect(connectors).toHaveLength(2)
  })
})

// ─── GitHubButton ─────────────────────────────────────────────────────────────

describe('GitHubButton', () => {
  it('renders Continue with GitHub text', () => {
    render(<GitHubButton loading={false} onGitHubClick={() => {}} />)
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
  })

  it('is disabled when loading=true', () => {
    render(<GitHubButton loading={true} onGitHubClick={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onGitHubClick when clicked', () => {
    const handler = vi.fn()
    render(<GitHubButton loading={false} onGitHubClick={handler} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('shows connecting state after click', () => {
    render(<GitHubButton loading={false} onGitHubClick={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/Connecting to GitHub/i)).toBeInTheDocument()
  })

  it('is disabled while in pending state', () => {
    render(<GitHubButton loading={false} onGitHubClick={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

// ─── IssuePreviewCard ─────────────────────────────────────────────────────────

describe('IssuePreviewCard', () => {
  it('renders issue title', () => {
    render(<IssuePreviewCard issue={{ title: 'Fix memory leak', number: 5 }} />)
    expect(screen.getByText('Fix memory leak')).toBeInTheDocument()
  })

  it('shows AI-suggested label when not verified', () => {
    render(<IssuePreviewCard issue={{ title: 'Fix bug', number: 1 }} verified={false} />)
    expect(screen.getByText(/Suggested first contribution/i)).toBeInTheDocument()
  })

  it('shows issue number when verified', () => {
    render(<IssuePreviewCard issue={{ title: 'Fix bug', number: 7 }} verified />)
    expect(screen.getByText(/Open issue #7/i)).toBeInTheDocument()
  })

  it('truncates description longer than 360 chars', () => {
    const longDesc = 'a'.repeat(400)
    render(<IssuePreviewCard issue={{ title: 'T', number: 1, description: longDesc }} />)
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument()
  })

  it('renders labels', () => {
    render(<IssuePreviewCard issue={{ title: 'T', number: 1, labels: ['bug', 'help wanted'] }} />)
    expect(screen.getByText('bug')).toBeInTheDocument()
    expect(screen.getByText('help wanted')).toBeInTheDocument()
  })

  it('shows unverified disclaimer when not verified', () => {
    render(<IssuePreviewCard issue={{ title: 'T', number: 1 }} verified={false} />)
    expect(screen.getByText(/AI-generated suggestion/i)).toBeInTheDocument()
  })
})

// ─── RepoStats ────────────────────────────────────────────────────────────────

describe('RepoStats', () => {
  it('renders open issues count', () => {
    render(<RepoStats openIssues={42} goodFirstIssues={5} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders good first issues count', () => {
    render(<RepoStats openIssues={10} goodFirstIssues={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders Not available when goodFirstIssues is null', () => {
    render(<RepoStats openIssues={10} goodFirstIssues={null} />)
    // Both "Good First Issues" and "Test Coverage" show "Not available"
    expect(screen.getAllByText('Not available')).toHaveLength(2)
  })

  it('formats large numbers', () => {
    render(<RepoStats openIssues={1500} goodFirstIssues={null} />)
    expect(screen.getByText('1.5k')).toBeInTheDocument()
  })
})

// ─── RepoBanner ───────────────────────────────────────────────────────────────

describe('RepoBanner', () => {
  const baseProps = {
    fullName: 'facebook/react',
    description: 'A JS library',
    stars: 200000,
    forks: 40000,
    openIssues: 800,
    language: 'JavaScript',
    topics: ['ui', 'frontend'],
  }

  it('renders repo full name', () => {
    render(<RepoBanner {...baseProps} />)
    expect(screen.getByText('facebook/react')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<RepoBanner {...baseProps} />)
    expect(screen.getByText('A JS library')).toBeInTheDocument()
  })

  it('renders fallback when description is null', () => {
    render(<RepoBanner {...baseProps} description={null} />)
    expect(screen.getByText('No repository description provided.')).toBeInTheDocument()
  })

  it('renders formatted stats', () => {
    render(<RepoBanner {...baseProps} />)
    expect(screen.getByText('200.0k stars')).toBeInTheDocument()
    expect(screen.getByText('40.0k forks')).toBeInTheDocument()
  })

  it('renders language when provided', () => {
    render(<RepoBanner {...baseProps} />)
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
  })

  it('renders topics', () => {
    render(<RepoBanner {...baseProps} />)
    expect(screen.getByText('ui')).toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
  })
})

// ─── ExperienceSelector ───────────────────────────────────────────────────────

describe('ExperienceSelector', () => {
  it('renders all three options', () => {
    render(<ExperienceSelector value="beginner" onChange={() => {}} />)
    expect(screen.getByText('Beginner')).toBeInTheDocument()
    expect(screen.getByText('Some experience')).toBeInTheDocument()
    expect(screen.getByText('Experienced')).toBeInTheDocument()
  })

  it('marks the selected option as checked', () => {
    render(<ExperienceSelector value="some" onChange={() => {}} />)
    const radios = screen.getAllByRole('radio')
    const checked = radios.find(r => (r as HTMLInputElement).checked)
    expect((checked as HTMLInputElement)?.value).toBe('some')
  })

  it('calls onChange with the selected value', () => {
    const onChange = vi.fn()
    render(<ExperienceSelector value="beginner" onChange={onChange} />)
    fireEvent.click(screen.getByDisplayValue('experienced'))
    expect(onChange).toHaveBeenCalledWith('experienced')
  })

  it('has radiogroup role with correct aria-label', () => {
    render(<ExperienceSelector value="beginner" onChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: /open-source contribution experience/i })).toBeInTheDocument()
  })
})
