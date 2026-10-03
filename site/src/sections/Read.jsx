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
            src="/media/02-focus-reader.png"
            alt="Calm's Focus Reader: an answer in its own reading pane with bionic fixation, and a Hebrew paragraph reading right to left"
          >
            Bionic fixation, adjustable 20–60%. Ease spacing for dyslexic reading. A spotlight
            that dims everything but the block you're on, and arrow keys to walk it. Each block
            gets its own reading direction, so Hebrew and Arabic read right to left without a setting.
          </FeatureBlock>

          <FeatureBlock
            title="Zen mode"
            shortcut="⌘⇧Z"
            delay={60}
          >
            The sidebar goes in one keypress, and with it whatever else each site puts around the
            conversation: the header on ChatGPT and Claude, the mode switcher and new-chat
            suggestions on Gemini. By default the input bar goes too, and comes back when you leave
            Zen. What remains is the conversation.
          </FeatureBlock>

          <FeatureBlock
            title="Hide the input bar"
            shortcut="⌘⇧H"
            delay={60}
          >
            Full-height reading with the composer out of the way. It hides itself when you scroll
            back up to reread, returns when you reach the bottom, and comes back the instant you
            start typing — whatever you typed lands in the input.
          </FeatureBlock>

          <FeatureBlock
            title="Reading width, type, and warmth"
            delay={60}
          >
            Set the measure, the font size and the line height, then warm the screen with Night, as
            strongly as you like. The reading ruler and grayscale are there when a page still has
            too much pull.
          </FeatureBlock>
        </div>
      </Container>
    </section>
  )
}
