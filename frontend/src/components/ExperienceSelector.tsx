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
    <div className="radio-row" role="radiogroup" aria-label="Open-source contribution experience">
      {options.map(option => (
        <label
          className={`radio-card${value === option.value ? ' sel' : ''}`}
          key={option.value}
        >
          <input className="choice-radio" name="experience" type="radio" value={option.value}
            checked={value === option.value} onChange={() => onChange(option.value)} />
          <span className="rc-icon" aria-hidden="true">{option.icon}</span>
          <span className="rc-lbl">{option.label}</span>
          <span className="rc-sub">{option.description}</span>
        </label>
      ))}
    </div>
  )
}
