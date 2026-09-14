import Reveal from './Reveal'

export default function SectionHeading({ label, title, children }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      {label && <Reveal y={8}><p className="label">{label}</p></Reveal>}
      <Reveal>
        <h2 className="type-display max-w-[18ch] text-[32px] text-balance tablet:text-h2">{title}</h2>
      </Reveal>
      {children && (
        <Reveal delay={80}>
          <p className="type-body max-w-[58ch] text-lead text-muted">{children}</p>
        </Reveal>
      )}
    </div>
  )
}
