import { useEffect, useState } from 'react'

interface Props {
  onRedirectDone: () => void
}

export default function SuccessState({ onRedirectDone }: Props) {
  const [barWidth, setBarWidth] = useState(0)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setBarWidth(100))
    })
    const timer = setTimeout(onRedirectDone, 3000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [onRedirectDone])

  return (
    <div className="success-state">
      <div className="success-circle">
        <svg viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="success-title">Welcome back!</div>
      <div className="success-sub">Signed in successfully. Taking you to your dashboard&hellip;</div>
      <div className="success-bar">
        <div className="success-bar-fill" style={{ width: `${barWidth}%` }} />
      </div>
      <div className="success-hint">Redirecting in 3 seconds</div>
    </div>
  )
}
