/**
 * @vitest-environment jsdom
 *
 * Tests for the repo-switcher outside-click-to-close behaviour added to
 * WorkflowLayout.
 *
 * WorkflowLayout has too many transitive dependencies to mount directly in
 * a unit test, so we test the behaviour via a minimal React harness that
 * replicates the exact useEffect + ref pattern used in the component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'

function makeStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

vi.stubGlobal('localStorage', makeStorageMock())
vi.stubGlobal('sessionStorage', makeStorageMock())

// ─── Minimal harness mirroring WorkflowLayout's switcher logic ────────────────

function SwitcherHarness() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  return (
    <div>
      <div ref={ref} data-testid="switcher-container">
        <button data-testid="toggle" onClick={() => setOpen(o => !o)}>
          Switch repository
        </button>
        {open && (
          <ul data-testid="switcher-menu">
            <li data-testid="repo-item">owner/repo</li>
          </ul>
        )}
      </div>
      <div data-testid="outside-area">Main content area</div>
    </div>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('repo switcher — outside-click-to-close', () => {
  beforeEach(() => {
    render(<SwitcherHarness />)
  })

  afterEach(() => {
    cleanup()
  })

  it('menu is closed by default', () => {
    expect(screen.queryByTestId('switcher-menu')).toBeNull()
  })

  it('opens the menu on button click', () => {
    fireEvent.click(screen.getByTestId('toggle'))
    expect(screen.getByTestId('switcher-menu')).toBeTruthy()
  })

  it('closes the menu when clicking outside the switcher container', () => {
    fireEvent.click(screen.getByTestId('toggle')) // open
    expect(screen.getByTestId('switcher-menu')).toBeTruthy()

    fireEvent.mouseDown(screen.getByTestId('outside-area'))
    expect(screen.queryByTestId('switcher-menu')).toBeNull()
  })

  it('keeps the menu open when clicking inside the switcher container', () => {
    fireEvent.click(screen.getByTestId('toggle')) // open
    fireEvent.mouseDown(screen.getByTestId('repo-item')) // click inside
    expect(screen.getByTestId('switcher-menu')).toBeTruthy()
  })

  it('keeps the menu open when clicking the toggle button itself', () => {
    fireEvent.click(screen.getByTestId('toggle')) // open
    fireEvent.mouseDown(screen.getByTestId('toggle')) // mousedown on toggle
    expect(screen.getByTestId('switcher-menu')).toBeTruthy()
  })

  it('can be re-opened after being closed by outside click', () => {
    fireEvent.click(screen.getByTestId('toggle')) // open
    fireEvent.mouseDown(screen.getByTestId('outside-area')) // close
    expect(screen.queryByTestId('switcher-menu')).toBeNull()

    fireEvent.click(screen.getByTestId('toggle')) // open again
    expect(screen.getByTestId('switcher-menu')).toBeTruthy()
  })

  it('closes the menu when toggle is clicked again (normal toggle)', () => {
    fireEvent.click(screen.getByTestId('toggle')) // open
    fireEvent.click(screen.getByTestId('toggle')) // close via toggle
    expect(screen.queryByTestId('switcher-menu')).toBeNull()
  })
})
