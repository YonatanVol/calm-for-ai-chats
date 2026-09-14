import { PRESETS } from './state'
import { ariaKeys, keys } from '../lib/platform'

/**
 * The visible way into every action, for people without a keyboard — and a
 * legend of the shortcuts for people with one. Toggles report their state
 * with aria-pressed, so "Zen, pressed" is what a screen reader hears.
 *
 * Choosing a preset starts the block straight away. In the extension the
 * preset lives in the Advanced drawer and the Console tile starts it; here
 * those two steps are one tap, because a demo should not charge a click it
 * could have taken.
 */
export default function Controls({ state, dispatch }) {
  const t = state.timer
  return (
    <div className="demo-controls">
      <div className="demo-controls-row" role="group" aria-label="Try Calm">
        <Toggle on={!!state.palette} combo="⌘K" onClick={() => dispatch({ type: 'palette' })}>Command palette</Toggle>
        <Toggle on={state.zen} combo="⌘⇧Z" onClick={() => dispatch({ type: 'zen' })}>Zen</Toggle>
        <Toggle on={state.composerHidden} combo="⌘⇧H" onClick={() => dispatch({ type: 'composer' })}>Hide input</Toggle>
        <Toggle on={state.reader} onClick={() => dispatch({ type: 'reader' })}>Focus Reader</Toggle>
      </div>

      <div className="demo-controls-row" role="group" aria-labelledby="demo-timer-label">
        <span className="demo-controls-label" id="demo-timer-label">Focus timer</span>
        {Object.entries(PRESETS).map(([key, p]) => {
          const on = t.running && state.S.pomoPreset === key
          return (
            <button
              key={key}
              type="button"
              className={`demo-ctl demo-ctl-preset${on ? ' is-on' : ''}`}
              aria-pressed={on}
              aria-label={`${p.name}: start a ${p.focus} minute focus block`}
              title={p.name}
              onClick={() => dispatch({ type: 'preset', key })}
            >
              {key}
            </button>
          )
        })}
        {t.running && (
          <button type="button" className="demo-ctl" onClick={() => dispatch({ type: 'timerEnd' })}>
            End timer
          </button>
        )}
      </div>
    </div>
  )
}

function Toggle({ on, combo, onClick, children }) {
  return (
    <button
      type="button"
      className={`demo-ctl${on ? ' is-on' : ''}`}
      aria-pressed={on}
      aria-keyshortcuts={combo ? ariaKeys(combo) : undefined}
      onClick={onClick}
    >
      <span>{children}</span>
      {combo && <kbd className="demo-ctl-kbd" aria-hidden="true">{keys(combo)}</kbd>}
    </button>
  )
}
