import Container from '../components/Container'
import SectionHeading from '../components/SectionHeading'
import FeatureBlock from '../components/FeatureBlock'

export default function Read() {
  return (
    <section id="read" className="py-24">
      <Container className="flex flex-col gap-14">
        <SectionHeading label="Reading" title="Read the answer, not the interface">
          The response gets lifted into a pane of Calm's own, so typography, fixation and
          spotlight never fight the site's styles.
        </SectionHeading>

        <div className="flex flex-col gap-5">
          <FeatureBlock
            title="Focus Reader"
            src="/media/05-margin.png"
            alt="Calm's reading width and typography controls applied to a chat response"
          >
            Bionic fixation, adjustable 20–60%. Ease spacing for dyslexic reading. A spotlight
            that dims everything but the block you're on, and arrow keys to walk it. Right-to-left
            is detected per paragraph, so mixed Hebrew and English reads correctly without a setting.
          </FeatureBlock>

          <FeatureBlock
            title="Zen mode"
            shortcut="⌘⇧Z"
            delay={60}
          >
            Sidebar, header and suggestion chips gone in one keypress. What remains is the
            conversation.
          </FeatureBlock>

          <FeatureBlock
            title="Hide the input bar"
            shortcut="⌘⇧H"
            delay={60}
          >
            Full-height reading with the composer out of the way. It auto-hides as you scroll and
            reappears the instant you start typing — whatever you typed lands in the input, nothing
            lost, in either writing direction.
          </FeatureBlock>

          <FeatureBlock
            title="Reading width, type, and warmth"
            delay={60}
          >
            Set the measure, the font size and the line height, then warm the screen with Night or
            Dim. The reading ruler and grayscale are there when a page still has too much pull.
          </FeatureBlock>
        </div>
      </Container>
    </section>
  )
}
