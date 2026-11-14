interface Props {
  value: string
  onChange: (value: 'beginner' | 'some' | 'experienced') => void
}

const options = [
  { value: 'beginner', icon: '🌱', label: 'Beginner', description: 'Never contributed before' },
  { value: 'some', icon: '🚀', label: 'Some experience', description: 'A few PRs merged' },
  { value: 'experienced', icon: '⚡', label: 'Experienced', description: 'Regular contributor' },
] as const

export default function ExperienceSelector({ value, onChange }: Props) {
  return (
    <div className="experience-options" role="radiogroup" aria-label="Open-source contribution experience">
      {options.map(option => (
        <button
          aria-checked={value === option.value}
          className={`experience-option${value === option.value ? ' is-selected' : ''}`}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="radio"
          type="button"
        >
          <span className="experience-icon" aria-hidden="true">{option.icon}</span>
          <span className="experience-label">{option.label}</span>
          <span className="experience-description">{option.description}</span>
        </button>
      ))}
    </div>
  )
}
