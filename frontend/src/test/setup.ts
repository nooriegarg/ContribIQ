import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Provide a full in-memory localStorage/sessionStorage mock for all test files.
// jsdom's implementation works, but some runner configurations swap it for a
// file-backed variant that lacks .clear() / other methods. This normalises the
// environment across every test file.
function makeStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length },
  }
}

vi.stubGlobal('localStorage', makeStorageMock())
vi.stubGlobal('sessionStorage', makeStorageMock())
