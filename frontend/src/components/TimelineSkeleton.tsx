import '../styles/TimelineSkeleton.css'

type TimelineSkeletonProps = {
  rows?: number
}

function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <span className="skeleton-block skeleton-dot" />
      <div className="skeleton-row-body skeleton-stack">
        <span className="skeleton-block skeleton-title" />
        <span className="skeleton-block skeleton-line skeleton-w-90" />
        <span className="skeleton-block skeleton-line skeleton-w-70" />
      </div>
    </div>
  )
}

function SkeletonIntro() {
  return (
    <div className="section-intro skeleton-stack">
      <span className="skeleton-block skeleton-eyebrow" />
      <span className="skeleton-block skeleton-heading" />
      <span className="skeleton-block skeleton-line skeleton-w-90" />
    </div>
  )
}

export default function TimelineSkeleton({ rows = 5 }: TimelineSkeletonProps) {
  return (
    <div className="grid2" aria-hidden="true">
      <section aria-hidden="true">
        <SkeletonIntro />
        <div>
          {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      </section>
      <aside aria-hidden="true">
        <SkeletonIntro />
        <section className="card skeleton-stack">
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-line skeleton-w-90" />
          <span className="skeleton-block skeleton-line skeleton-w-70" />
          <span className="skeleton-block skeleton-btn" />
        </section>
        <section className="card mt16 skeleton-stack">
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-line skeleton-w-70" />
        </section>
      </aside>
    </div>
  )
}