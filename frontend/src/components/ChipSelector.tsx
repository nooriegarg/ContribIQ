import { useRef, useState } from 'react'

interface Option { value: string; label: string }

interface Props {
  label: string
  options: Option[]
  selected: string[]
  onChange: (value: string) => void
  allowCustom?: boolean
}

export default function ChipSelector({ label, options, selected, onChange, allowCustom }: Props) {
  const [input, setInput] = useState('')
  const [customOptions, setCustomOptions] = useState<string[]>(() => {
    // Seed with any custom values already in `selected` on first render
    const presetValues = new Set(options.map(o => o.value.toLowerCase()))
    return selected.filter(v => !presetValues.has(v.toLowerCase()))
  })
  const inputRef = useRef<HTMLInputElement>(null)

  function addCustom() {
    const trimmed = input.trim()
    if (!trimmed) return
    const alreadyExists = [...options, ...customOptions.map(v => ({ value: v }))].some(
      o => o.value.toLowerCase() === trimmed.toLowerCase()
    )
    if (!alreadyExists) {
      setCustomOptions(prev => [...prev, trimmed])
      onChange(trimmed)
    }
    setInput('')
    inputRef.current?.focus()
  }

  function removeCustom(val: string) {
    setCustomOptions(prev => prev.filter(v => v.toLowerCase() !== val.toLowerCase()))
    // If currently selected, deselect it too
    if (selected.some(v => v.toLowerCase() === val.toLowerCase())) {
      onChange(val)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addCustom()
    }
  }

  return (
    <div className="chip-selector" role="group" aria-label={label}>
      <div className="chip-grid">
        {options.map(option => {
          const isSelected = selected.some(v => v.toLowerCase() === option.value.toLowerCase())
          return (
            <button
              aria-pressed={isSelected}
              className={`chip${isSelected ? ' sel' : ''}`}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <span className="chip-box" aria-hidden="true">{isSelected ? '✓' : ''}</span>
              {option.label}
            </button>
          )
        })}

        {allowCustom && customOptions.map(val => {
          const isSelected = selected.some(v => v.toLowerCase() === val.toLowerCase())
          return (
            <button
              aria-pressed={isSelected}
              className={`chip chip-custom${isSelected ? ' sel' : ''}`}
              key={val}
              onClick={() => onChange(val)}
              type="button"
            >
              <span className="chip-box" aria-hidden="true">{isSelected ? '✓' : ''}</span>
              {val}
              <span
                className="chip-remove"
                aria-label={`Remove ${val}`}
                onClick={e => { e.stopPropagation(); removeCustom(val) }}
              >×</span>
            </button>
          )
        })}
      </div>

      {allowCustom && (
        <div className="chip-add-row">
          <input
            ref={inputRef}
            className="chip-add-input"
            type="text"
            placeholder="Add custom…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={`Add custom ${label.toLowerCase()}`}
          />
          <button
            className="btn btn-s chip-add-btn"
            type="button"
            onClick={addCustom}
            disabled={!input.trim()}
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
