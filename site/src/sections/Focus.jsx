import Container from '../components/Container'
import SectionHeading from '../components/SectionHeading'
import FeatureBlock from '../components/FeatureBlock'
import { keys } from '../lib/platform'

export default function Focus() {
  return (
    <section id="focus" className="py-24">
      <Container className="flex flex-col gap-14">
        <SectionHeading label="Focus" title="Built for attention that wanders">
          Calm was designed around ADHD workflows first, not retrofitted for them. Its menus open
          only when you ask, and {keys('⌘K')} reaches every mode. Three things appear on their own, all of
          them quiet: a three-card welcome on first run, the break screen when a focus block ends,
          and a card on returning after a long gap, if you had set a goal or parked a thought.
        </SectionHeading>

        <div className="flex flex-col gap-5">
          <FeatureBlock
            title="One menu. Not five."
            src="/media/01-one-menu.png"
            alt="Calm's console — a single panel with a timer tile, quick toggles and inline sliders"
          >
            One draggable pill that snaps to the nearest corner. It opens a single panel — live
            timer, quick toggles, inline sliders, and an Advanced drawer that slides in rather than
            spawning a second window.
          </FeatureBlock>

          <FeatureBlock
            title="Or no panel at all"
            src="/media/05-margin.png"
            alt="Calm's margin menu: a few quiet marks beside the conversation instead of a panel"
            delay={60}
          >
            Prefer nothing floating over the page? Switch the menu to the margin. Where the page
            has room beside the text, Calm's controls become a few faint marks there that brighten
            as your pointer comes near; where it does not, the corner pill stays.
          </FeatureBlock>

          <FeatureBlock
            title="Command palette"
            shortcut="⌘K"
            src="/media/04-palette.png"
            alt="Calm's command palette searching “ni”: Night, Night Level, Reading ruler and Pomodoro Cycles"
            delay={60}
          >
            Every mode and action, and nearly every setting, behind one keystroke. Arrow keys nudge
            numeric settings in place, so you can adjust reading width without leaving the keyboard
            or losing the line you were on.
          </FeatureBlock>

          <FeatureBlock
            title="Pomodoro that gets out of the way"
            src="/media/03-timer.png"
            alt="Calm's console with a focus block running: 24:31 left, block 2 of 4, Zen on"
            delay={60}
          >
            Presets for 10/2, 25/5, 52/17 and 90/20. By default Zen comes on during focus, a chime
            marks the end, and a thin bar across the top of the screen shows how far along you are
            without a number to stare at.
          </FeatureBlock>

          <FeatureBlock
            title="Intention, and a place to park the rest"
            shortcut="⌘⇧K"
            delay={60}
          >
            “What did you come to do?”, with up to three first steps. It never opens by itself —
            you ask for it. When something unrelated surfaces mid-task, the thought parking lot
            takes it so you don't have to choose between losing it and following it.
          </FeatureBlock>

          <FeatureBlock
            title="Time awareness"
            delay={60}
          >
            A quiet time-on-page chip and a hyperfocus nudge. Enough to notice three hours went by.
            Not enough to interrupt the one time it was worth it.
          </FeatureBlock>

          <FeatureBlock
            title="Presentation mode"
            shortcut="⌘⇧P"
            delay={60}
          >
            Everything hidden for clean captures and screen shares. Esc exits.
          </FeatureBlock>
        </div>
      </Container>
    </section>
  )
}
