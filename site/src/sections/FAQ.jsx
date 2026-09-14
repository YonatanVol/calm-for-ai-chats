import Container from '../components/Container'
import SectionHeading from '../components/SectionHeading'
import Reveal from '../components/Reveal'
import Accordion from '../components/Accordion'

const FAQS = [
  ['Is Calm really free?', 'Yes. There is no paid tier, no account, and nothing to unlock.'],
  ['Why is it not on the Chrome Web Store?', 'It is not listed yet. Until it is, installing means developer mode — the steps above take about two minutes.'],
  ['Does it work on Gemini and Claude too?', 'Yes. ChatGPT, Gemini and Claude are all supported.'],
  ['How does it work without permissions?', 'Chrome lets an extension run a script on the sites it names without asking for extra permissions. Calm names three: ChatGPT, Gemini and Claude. There it reads the page to restyle it and to copy the latest answer into Focus Reader. It asks Chrome for nothing else.'],
  ['Where are my settings stored?', 'In your browser. That means they survive updates, and it also means they do not sync to your other machines.'],
  ['Does it change what the AI says?', 'No. Calm only affects how the response is displayed. The text is untouched.'],
  ['Does it support Hebrew and Arabic?', 'Yes, including per-paragraph right-to-left detection in the reader and in the input bar.'],
  ['Will it slow the page down?', 'No network calls and no background worker. It restyles the DOM already in front of you.'],
  ['Can I turn off the animations?', 'Reduce motion is a built-in toggle, and Calm also respects your operating system setting.'],
  ['Does it collect analytics?', 'No. Its source has no analytics and no network code, and there is no account to tie anything to. An empty permission list alone would not rule that out, which is why the source is public for you to check.'],
]

export default function FAQ() {
  return (
    <section id="faq" className="py-24">
      <Container prose className="flex flex-col gap-14">
        <SectionHeading label="FAQ" title="Questions worth answering before you install" />
        <div className="grid gap-5 tablet:grid-cols-2">
          {FAQS.map(([q, a], i) => (
            <Reveal key={q} delay={(i % 2) * 50}>
              <Accordion question={q} answer={a} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
