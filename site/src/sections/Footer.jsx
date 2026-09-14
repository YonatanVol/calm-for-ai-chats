import Container from '../components/Container'
import Button from '../components/Button'
import Reveal from '../components/Reveal'

const COLUMNS = [
  { title: 'Product', links: [['Reading', '#read'], ['Focus', '#focus'], ['Shortcuts', '#shortcuts'], ['Install', '#install']] },
  { title: 'Trust', links: [['Privacy', '#privacy'], ['Security', 'https://github.com/YonatanVol/calm-for-ai-chats/blob/main/SECURITY.md'], ['Changelog', 'https://github.com/YonatanVol/calm-for-ai-chats/blob/main/CHANGELOG.md'], ['Roadmap', 'https://github.com/YonatanVol/calm-for-ai-chats/blob/main/ROADMAP.md']] },
  { title: 'Elsewhere', links: [['GitHub', 'https://github.com/YonatanVol/calm-for-ai-chats'], ['Releases', 'https://github.com/YonatanVol/calm-for-ai-chats/releases/latest']] },
]

export default function Footer() {
  return (
    <footer className="border-t border-line py-24">
      <Container className="flex flex-col gap-16">
        {/* Same move as Supaste's footer: repeat the hero headline
            verbatim, italic and all. Free brand recall at the exit. */}
        <Reveal className="flex flex-col items-center gap-6 text-center">
          <p className="label">Chrome extension</p>
          <h2 className="type-display text-[32px] tablet:text-h2">
            <span className="block">Read without noise.</span>
            <span className="block text-muted italic">Think without drift.</span>
          </h2>
          <Button href="#install">Install Calm — free</Button>
        </Reveal>

        <div className="grid gap-10 border-t border-line pt-14 tablet:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <h3 className="label">{col.title}</h3>
              <ul className="flex flex-col gap-3">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="type-body text-body text-muted transition-colors hover:text-text">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-8 tablet:flex-row tablet:items-center tablet:justify-between">
          <p className="type-body text-fine text-faint">© 2026 Yonatan Volsky. All rights reserved.</p>
          <p className="type-body text-fine text-faint">No analytics on this page either.</p>
        </div>
      </Container>
    </footer>
  )
}
