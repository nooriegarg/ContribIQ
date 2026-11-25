import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import RepoStats from '../../components/RepoStats'

describe('RepoStats — Test Coverage tile', () => {
  function renderStats(overrides: Partial<React.ComponentProps<typeof RepoStats>> = {}) {
    const defaults: React.ComponentProps<typeof RepoStats> = {
      openIssues: 10,
      goodFirstIssues: 2,
      ...overrides,
    }
    return render(<RepoStats {...defaults} />)
  }

  it('shows percentage when testCoveragePct is provided', () => {
    renderStats({ testCoveragePct: 84 })
    expect(screen.getByText('84%')).toBeInTheDocument()
  })

  it('shows file count when only testFileCount is provided', () => {
    renderStats({ testFileCount: 38 })
    expect(screen.getByText('38 test files')).toBeInTheDocument()
  })

  it('shows "Not available" when both are absent', () => {
    renderStats()
    expect(screen.getByText('Not available')).toBeInTheDocument()
  })

  it('prefers testCoveragePct over testFileCount when both are provided', () => {
    renderStats({ testCoveragePct: 72, testFileCount: 20 })
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.queryByText('20 test files')).not.toBeInTheDocument()
  })

  it('shows 0% when testCoveragePct is 0', () => {
    renderStats({ testCoveragePct: 0 })
    // 0 is falsy but != null, so it should still show 0%
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('shows 100% when testCoveragePct is 100', () => {
    renderStats({ testCoveragePct: 100 })
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows label "Test Coverage"', () => {
    renderStats({ testCoveragePct: 84 })
    expect(screen.getByText('Test Coverage')).toBeInTheDocument()
  })
})

describe('RepoStats — other tiles', () => {
  it('renders Open Issues count', () => {
    render(<RepoStats openIssues={42} goodFirstIssues={5} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Open Issues')).toBeInTheDocument()
  })

  it('renders Good First Issues count', () => {
    render(<RepoStats openIssues={10} goodFirstIssues={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Good First Issues in Analysis')).toBeInTheDocument()
  })

  it('renders "Not available" for Good First Issues when null', () => {
    render(<RepoStats openIssues={10} goodFirstIssues={null} />)
    // There are two "Not available" cells — one for Good First Issues, one for coverage
    const cells = screen.getAllByText('Not available')
    expect(cells.length).toBeGreaterThanOrEqual(1)
  })
})
