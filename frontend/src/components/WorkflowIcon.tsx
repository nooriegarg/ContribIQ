const paths = {
  cube: 'M10 2 3 6.5V14l7 4.5 7-4.5V6.5z',
  arrow: 'M3 10h14m-5-5 5 5-5 5',
  code: 'm6 5-5 5 5 5m8-10 5 5-5 5M12 3 8 17',
  folder: 'M2 5h6l2 2h8v10H2z',
  stack: 'M2 2h6v6H2zm10 0h6v6h-6zM2 12h6v6H2zm10 0h6v6h-6z',
  check: 'm4 10 4 4 8-8',
  clock: 'M10 4v6l4 2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
} as const

export default function WorkflowIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
