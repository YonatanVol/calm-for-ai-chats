import Container from '../components/Container'
import Reveal from '../components/Reveal'
import Button from '../components/Button'

const STEPS = [
  ['Download and unzip', 'Grab calm-extension.zip from Releases. Keep the unzipped folder somewhere safe — Chrome loads it from that path on every start, so moving or deleting it uninstalls Calm.'],
  ['Open chrome://extensions', 'Turn on Developer mode, top right.'],
  ['Load unpacked', 'Select the folder you unzipped.'],
  ['Open a chat', 'ChatGPT, Gemini or Claude. The Calm pill appears bottom-right. Press ⌘K to see everything it does.'],
]

/**
 * Calm is not on the Chrome Web Store yet, so installing means
 * developer mode and a Chrome security warning. Hiding that would
 * strand people at step two and cost more trust than it saves —
 * especially on a page whose main claim is about permissions.
 *
 * So the warning gets addressed directly, using the same framing as
 * the project's README.
 */
export default function Install() {
  return (
    <section id="install" className="py-24">
      <Container prose className="flex flex-col gap-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <Reveal y={8}><p className="label">Install · free</p></Reveal>
          <Reveal>
            <h2 className="type-display max-w-[18ch] text-[32px] text-balance tablet:text-h2">
              Two minutes.
              <span className="block text-muted italic">No tools required.</span>
            </h2>
          </Reveal>
        </div>

        <Reveal delay={80}>
          <ol className="flex flex-col gap-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-5 rounded-card border border-line bg-surface p-6">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line
                  font-mono text-fine text-muted" aria-hidden="true">{i + 1}</span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="type-body text-body font-medium">{title}</h3>
                  <p className="type-body text-body text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={120}>
          <div className="flex flex-col gap-3 rounded-card border border-ember/25 bg-ember/[0.04] p-6">
            <h3 className="type-body text-body font-medium text-ember">Chrome will warn you</h3>
            <p className="type-body text-body text-muted">
              It says developer-mode extensions can be a security risk, and that warning is honest —
              an unpacked extension is just a folder, and nobody has reviewed it. The reason to be
              comfortable here is that this one asks Chrome for no extension permissions and runs only
              on the three chat sites. You can confirm that in
              its <code className="font-mono text-fine text-faint">manifest.json</code> before you load
              it. Dismissing the warning once is fine. Getting into the habit of dismissing it is not.
            </p>
          </div>
        </Reveal>

        <Reveal delay={160} className="flex flex-col items-center gap-4">
          <Button href="https://github.com/YonatanVol/calm-for-ai-chats/releases/latest">
            Download the latest release
          </Button>
          <p className="type-body text-fine text-faint">
            Desktop Chrome · Works on ChatGPT, Gemini and Claude · Updating replaces the folder; your settings survive.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
