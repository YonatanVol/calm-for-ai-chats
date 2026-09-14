import { useState } from 'react'

export default function Accordion({ question, answer }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-card border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-6 text-left"
      >
        <span className="type-body text-body font-medium">{question}</span>
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line
            text-muted transition-transform duration-500"
          style={{ transform: open ? 'rotate(45deg)' : 'none' }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div className="grid transition-[grid-template-rows] duration-500 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <p className="type-body px-6 pb-6 text-body text-muted">{answer}</p>
        </div>
      </div>
    </div>
  )
}
