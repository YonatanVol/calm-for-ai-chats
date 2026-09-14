import Reveal from './Reveal'
import Shot from './Shot'
import Kbd from './Kbd'

/**
 * The repeated card. Same discipline as the teardown's FeatureCard:
 * one layout, used for every feature, never alternated. Variety reads
 * as indecision; repetition reads as a system.
 */
export default function FeatureBlock({ title, shortcut, children, src, alt, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <article className="flex flex-col gap-8 rounded-card border border-line bg-surface p-6 tablet:p-10">
        <header className="flex max-w-[52ch] flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="type-display text-[28px] tablet:text-h3">{title}</h3>
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </div>
          <p className="type-body text-body text-muted">{children}</p>
        </header>
        {src && <Shot src={src} alt={alt} />}
      </article>
    </Reveal>
  )
}
