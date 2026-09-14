export default function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center rounded-[5px] border border-line bg-raised
      px-1.5 py-0.5 font-mono text-[11px] text-muted">
      {children}
    </kbd>
  )
}
