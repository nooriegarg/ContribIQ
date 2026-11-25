/**
 * Tests for QAPanel — the codebase Q&A form.
 *
 * Covers form state (empty / loading guard), successful answer display,
 * source chip rendering, generic error display, and the special "not indexed"
 * error message that guides users to re-run analysis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QAPanel from '../../components/QAPanel'

vi.mock('../../api/client', () => ({
  apiCall: vi.fn(),
}))

import { apiCall } from '../../api/client'

const mockApiCall = apiCall as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockApiCall.mockReset()
})

describe('QAPanel — initial render', () => {
  it('renders the question input and Ask button', () => {
    render(<QAPanel taskId="task-1" />)
    expect(screen.getByPlaceholderText(/authentication/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument()
  })

  it('Ask button is disabled when input is empty', () => {
    render(<QAPanel taskId="task-1" />)
    expect(screen.getByRole('button', { name: /ask/i })).toBeDisabled()
  })

  it('Ask button is enabled once the user types a question', () => {
    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'How does auth work?' } })
    expect(screen.getByRole('button', { name: /ask/i })).toBeEnabled()
  })

  it('Ask button is disabled for whitespace-only input', () => {
    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /ask/i })).toBeDisabled()
  })
})

describe('QAPanel — loading state', () => {
  it('shows "Asking..." and disables the button while the request is in flight', async () => {
    mockApiCall.mockReturnValue(new Promise(() => {}))

    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What does main.py do?' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)

    expect(await screen.findByRole('button', { name: /asking/i })).toBeDisabled()
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})

describe('QAPanel — successful response', () => {
  it('displays the answer text after the API resolves', async () => {
    mockApiCall.mockResolvedValue({ answer: 'Authentication is handled via JWT tokens.', sources: [] })

    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'How does auth work?' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)

    expect(await screen.findByText('Authentication is handled via JWT tokens.')).toBeInTheDocument()
  })

  it('renders source chips when sources are returned', async () => {
    mockApiCall.mockResolvedValue({
      answer: 'JWT is validated in auth.py.',
      sources: ['backend/auth.py', 'backend/middleware.py'],
    })

    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Where is JWT checked?' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)

    expect(await screen.findByText('backend/auth.py')).toBeInTheDocument()
    expect(screen.getByText('backend/middleware.py')).toBeInTheDocument()
  })

  it('does not render the sources section when sources array is empty', async () => {
    mockApiCall.mockResolvedValue({ answer: 'No sources.', sources: [] })

    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Quick question' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)

    await screen.findByText('No sources.')
    expect(screen.queryByText('Sources')).not.toBeInTheDocument()
  })
})

describe('QAPanel — error handling', () => {
  it('displays a generic error message when the API rejects', async () => {
    mockApiCall.mockRejectedValue(new Error('Network error'))

    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What is the architecture?' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)

    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
  })

  it('shows the re-run guidance message for embedding / not-indexed errors', async () => {
    mockApiCall.mockRejectedValue(new Error('Repository has not been indexed yet'))

    render(<QAPanel taskId="task-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Any question' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)

    expect(await screen.findByText(/still being set up/i)).toBeInTheDocument()
  })

  it('allows a new question after an error', async () => {
    mockApiCall
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ answer: 'Second attempt works.', sources: [] })

    render(<QAPanel taskId="task-1" />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'First attempt' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)
    await screen.findByText(/timeout/i)

    fireEvent.change(input, { target: { value: 'Second attempt' } })
    fireEvent.submit(screen.getByRole('button', { name: /ask/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Second attempt works.')).toBeInTheDocument()
    })
  })
})
