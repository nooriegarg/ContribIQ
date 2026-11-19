import { useEffect, useState } from 'react'

export interface ChecklistItem {
  step: string
  description?: string
}

interface ChecklistProps {
  items: ChecklistItem[]
  issueKey: string
}

export default function Checklist({ items, issueKey }: ChecklistProps) {
  const storageKey = `checklist:${issueKey}`

  const [checked, setChecked] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? (JSON.parse(stored) as number[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked))
  }, [checked, storageKey])

  function toggle(index: number) {
    setChecked(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
    )
  }

  return (
    <div>
      <p className="checklist-progress" role="status">
        {checked.length} of {items.length} complete
      </p>
      <div className="checklist">
        {items.map((item, index) => (
          <label
            className={`cl-item${checked.includes(index) ? ' checked' : ''}`}
            key={index}
          >
            <input
              type="checkbox"
              checked={checked.includes(index)}
              onChange={() => toggle(index)}
            />
            <span className="cl-txt">{item.step}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
