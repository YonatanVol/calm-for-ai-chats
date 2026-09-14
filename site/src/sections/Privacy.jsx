import Container from '../components/Container'
import Reveal from '../components/Reveal'

const CLAIMS = [
  ['permissions', '[]', 'Asks Chrome for no extension permissions.'],
  ['host_permissions', '[]', 'No extra site access requested.'],
  ['content_scripts', '3 sites', 'Runs only on chatgpt.com, gemini.google.com and claude.ai, and reads those pages to restyle them. Chrome lists this as site access.'],
  ['network code', '0', 'No fetch, XHR, beacon or socket in the source.'],
  ['account', 'none', 'There is nothing to sign into.'],
]

/**
 * The section shows the manifest rather than describing it, and tells the
 * reader exactly how to check. Verifiable claims are what make every other
 * claim on a page believable — so every line here is one a reader can
 * confirm, and the section says plainly where the guarantee stops.
 *
 * What an empty permission list does NOT do: stop a content script from
 * reaching the network through the page it runs on (inserting an image is
 * enough). So the claim is "no network code in the source", which is
 * checkable, never "cannot contact a server", which is not true.
 */
export default function Privacy() {
  return (
    <section id="privacy" className="py-24">
      <Container prose className="flex flex-col gap-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <Reveal y={8}><p className="label">Privacy</p></Reveal>
          <Reveal>
            <h2 className="type-display max-w-[20ch] text-[32px] text-balance tablet:text-h2">
              Don't take our word for it.
              <span className="block text-muted italic">Read the manifest.</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="type-body max-w-[58ch] text-lead text-muted">
              Calm asks Chrome for no extension permissions, has no network code and no account.
              It runs on three chat sites, where it reads and restyles the page you already have open.
            </p>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <span className="label">manifest.json</span>
            </div>
            <ul className="divide-y divide-line">
              {CLAIMS.map(([key, value, note]) => (
                <li key={key} className="flex flex-col gap-1 px-5 py-4 tablet:flex-row tablet:items-baseline tablet:gap-5">
                  <code className="font-mono text-fine text-muted tablet:w-44 tablet:shrink-0">{key}</code>
                  <code className="font-mono text-body text-ember whitespace-nowrap tablet:shrink-0">{value}</code>
                  <span className="type-body text-fine text-faint tablet:ml-auto tablet:text-right">{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="mx-auto flex max-w-[58ch] flex-col gap-4">
            <p className="type-body text-center text-fine text-faint">
              <span className="text-muted">Check it yourself.</span> Before loading, open{' '}
              <code className="font-mono text-muted">manifest.json</code> in the folder you downloaded.
              After loading, <code className="font-mono text-muted">chrome://extensions</code> → Calm →
              Details lists exactly those three sites under Permissions, and nothing else.
            </p>
            <p className="type-body text-center text-fine text-faint">
              <span className="text-muted">Where the guarantee stops.</span> Chrome does not prevent a
              script on a page from reaching the internet through that page. Calm's source has no code
              that does, but that is for you to confirm by reading it, not something Chrome enforces — so
              check again when you update.
            </p>
            <p className="type-body text-center text-fine text-faint">
              Settings and parked thoughts are saved on your computer, in each chat site's own storage.
              They never go to a Calm server, but that site can read them, and they don't follow you to
              another machine.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
