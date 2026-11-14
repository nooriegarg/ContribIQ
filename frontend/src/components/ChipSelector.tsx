interface Props {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (value: string) => void
}

export default function ChipSelector({ label, options, selected, onChange }: Props) {
  return (
    <div className="profile-chip-list" role="group" aria-label={label}>
      {options.map(option => {
        const isSelected = selected.includes(option.value)
        return (
          <button
            aria-pressed={isSelected}
            className={`profile-chip${isSelected ? ' is-selected' : ''}`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <span className="profile-chip-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
