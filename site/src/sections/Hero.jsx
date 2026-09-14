import Container from '../components/Container'
import Button from '../components/Button'
import Reveal from '../components/Reveal'
import Bionic from '../components/Bionic'
import Demo from '../demo/Demo'

const TRUST = ['No extension permissions', 'No account', 'No network code']

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Supaste's brand object is a 1400px electric-blue gradient.
          Calm's is the opposite claim, so it gets the opposite
          treatment: a barely-there warm bloom over near-black. A
          product that sells quiet cannot introduce itself loudly. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px]"
        style={{
          background:
            'radial-gradient(120% 70% at 50% -10%, #26272b 0%, #17181b 38%, #0b0c0e 72%, #0b0c0e 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-[0.13]"
        style={{
          background: 'radial-gradient(50% 60% at 50% 0%, #f59e0b 0%, transparent 70%)',
        }}
      />

      <Container className="flex flex-col items-center gap-14 pt-40 pb-24 text-center">
        <div className="flex flex-col items-center gap-7">
          <Reveal y={8}>
            <p className="label">
              Chrome extension
              <span className="hidden tablet:inline"> · ChatGPT · Gemini · Claude</span>
            </p>
          </Reveal>

          {/* Supaste sets line one in bold sans and line two in serif
              italic. Calm inverts it — the whole headline is serif at
              regular weight, and only the italic marks the turn. Same
              structural contrast, a quieter voice. */}
          <Reveal y={12} delay={80}>
            <h1 className="type-display text-[40px] tablet:text-[56px] desktop:text-[76px]">
              <span className="block">Read without noise.</span>
              <span className="block text-muted italic">Think without drift.</span>
            </h1>
          </Reveal>

          <Reveal y={12} delay={160}>
            <p className="type-body max-w-[58ch] text-lead text-muted">
              AI chats are built to keep you typing. Calm turns one into something you can
              actually read and think in — a reading pane of its own, one menu instead of
              five, and a timer that knows when to leave you alone.
            </p>
          </Reveal>
        </div>

        <Reveal y={12} delay={240} className="flex flex-col items-center gap-6">
          <Button href="#install">Install Calm — free</Button>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST.map((t) => (
              <li key={t} className="type-body text-fine text-faint">{t}</li>
            ))}
          </ul>
        </Reveal>

        {/* The flourish: the page reads the way the product makes
            things read. Nobody else's landing page can do this. */}
        <Reveal y={12} delay={320}>
          <p className="type-body max-w-[52ch] text-body text-faint">
            <Bionic>
              This sentence is set the way Calm sets one. The bold openings are fixation
              points — your eye lands, recognises the word, and moves on.
            </Bionic>
          </p>
        </Reveal>

        {/* Tried, not watched. The screenshot that used to sit here moved
            to the Focus Reader block, where it describes what it shows. */}
        <Reveal y={20} delay={120} className="w-full max-w-[1000px]">
          <Demo />
        </Reveal>
      </Container>
    </section>
  )
}
