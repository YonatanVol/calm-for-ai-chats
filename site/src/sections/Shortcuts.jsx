import Container from '../components/Container'
import SectionHeading from '../components/SectionHeading'
import Reveal from '../components/Reveal'
import Kbd from '../components/Kbd'

const KEYS = [
  ['Command palette — everything', '⌘K'],
  ['Toggle the input bar', '⌘⇧H'],
  ['Back to the start of the answer', '⌘⇧J'],
  ['Zen mode', '⌘⇧Z'],
  ['Presentation mode  (Esc exits)', '⌘⇧P'],
  ['Thought parking lot', '⌘⇧K'],
]

export default function Shortcuts() {
  return (
    <section id="shortcuts" className="py-24">
      <Container prose className="flex flex-col gap-12">
        <SectionHeading label="Keyboard" title="Six keys is the whole product">
          If you only ever learn one, learn ⌘K — every mode, action and setting is behind it.
        </SectionHeading>

        <Reveal delay={80}>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {KEYS.map(([action, key]) => (
              <li key={key} className="flex items-center justify-between gap-6 px-6 py-4">
                <span className="type-body text-body text-muted">{action}</span>
                <Kbd>{key}</Kbd>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <p className="type-body text-center text-fine text-faint">
            On Windows and Linux, ⌘ is Ctrl.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
