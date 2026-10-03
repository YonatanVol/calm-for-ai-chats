import Container from '../components/Container'
import SectionHeading from '../components/SectionHeading'
import Reveal from '../components/Reveal'

const FOR = [
  { title: 'ADHD readers', body: 'Menus open only when you ask. One menu, one keystroke, a parking lot for the thought that just arrived, and a nudge when hyperfocus has run long.' },
  { title: 'Dyslexic readers', body: 'Ease spacing, adjustable bionic fixation, a reading ruler, and a spotlight that dims every block but the one you are on.' },
  { title: 'Hebrew and Arabic readers', body: 'Focus Reader gives each block of an answer its own direction, so Hebrew and Arabic read right to left — and line up on the right — without a setting.' },
  { title: 'People who read AI answers all day', body: 'Long responses in a pane built for reading rather than a chat column built to keep you replying.' },
  { title: 'Anyone on a small screen', body: 'Hiding the composer and the sidebar gives a laptop back the vertical space the interface was using.' },
  { title: 'People who present from a browser', body: 'Presentation mode strips the interface for clean captures, screenshots and screen shares.' },
]

export default function Audience() {
  return (
    <section className="py-24">
      <Container className="flex flex-col gap-14">
        <SectionHeading label="Who it's for" title="Written for the people it was built with">
          Calm started as an accessibility tool and stayed one. Everything else followed from that.
        </SectionHeading>

        <div className="grid gap-5 tablet:grid-cols-2 desktop:grid-cols-3">
          {FOR.map((f, i) => (
            <Reveal key={f.title} delay={i * 50}>
              <article className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-7">
                <h3 className="type-display text-[22px]">{f.title}</h3>
                <p className="type-body text-body text-muted">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
