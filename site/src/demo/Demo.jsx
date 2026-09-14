import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { initialState, isEscapable, reducer } from './state'
import { runPreview } from './autoplay'
import ChatWindow from './ChatWindow'
import Palette from './Palette'
import FocusReader from './FocusReader'
import Controls from './Controls'
import { TimeBar, TimerOverlay, TimerWidget } from './Timer'
import { keys } from '../lib/platform'

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const touchOnly = () => matchMedia('(hover: none) and (pointer: coarse)').matches

function isEditable(el) {
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
}

/**
 * Calm, tried rather than watched.
 *
 * Input rules, because this sits on a page people also scroll and type on:
 *   - Shortcuts fire only while focus is inside the demo, and preventDefault
 *     runs only for a shortcut the demo actually handled — ⌘⇧Z is redo and
 *     ⌘K means something in several browsers, everywhere else on the page.
 *   - Every action also has a button under the chat; phones have no keys.
 *   - Escape closes the top layer (palette, Focus Reader, timer screen), then
 *     resets the demo.
 *
 * Until someone clicks, taps, focuses or presses a key in it, a preview plays
 * while the demo is on screen. Taking over stops it at once and starts from a
 * clean state. With prefers-reduced-motion there is no preview at all.
 */
export default function Demo() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [previewing, setPreviewing] = useState(() => !reducedMotion())
  const [onScreen, setOnScreen] = useState(false)
  const [keycap, setKeycap] = useState(null)
  const [keysOn, setKeysOn] = useState(false)
  const [touch] = useState(touchOnly)

  const rootRef = useRef(null)
  const windowRef = useRef(null)
  const composerRef = useRef(null)
  const stateRef = useRef(state)
  const previewCtl = useRef(null)
  const previewingRef = useRef(previewing)
  const lastFocus = useRef(null)
  const focusComposer = useRef(false)
  const expandAsked = useRef(false)
  stateRef.current = state
  if (!state.timer.overlay) expandAsked.current = false
  previewingRef.current = previewing

  /* ---------- the preview ---------- */

  const takeOver = useCallback(() => {
    if (!previewingRef.current) return
    previewingRef.current = false
    previewCtl.current?.abort()
    previewCtl.current = null
    setKeycap(null)
    dispatch({ type: 'reset', full: true, quiet: true })
    setPreviewing(false)
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting && document.visibilityState === 'visible'), { threshold: 0.35 })
    io.observe(el)
    const onVis = () => {
      if (document.visibilityState !== 'visible') setOnScreen(false)
      else { io.unobserve(el); io.observe(el) } // re-measure
    }
    document.addEventListener('visibilitychange', onVis)
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => { if (mq.matches) takeOver() }
    mq.addEventListener('change', onMotion)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); mq.removeEventListener('change', onMotion) }
  }, [takeOver])

  useEffect(() => {
    if (!previewing || !onScreen) return
    const ctl = new AbortController()
    previewCtl.current = ctl
    runPreview({ dispatch, showKeys: setKeycap, signal: ctl.signal })
    return () => {
      // Scrolled away or tab hidden: stop and start over next time. A
      // takeover has already stopped it and reset, so leave that alone.
      if (!ctl.signal.aborted) {
        ctl.abort()
        dispatch({ type: 'reset', full: true, quiet: true })
      }
    }
  }, [previewing, onScreen])

  /* ---------- the clock ---------- */

  useEffect(() => {
    if (!state.timer.running || state.timer.paused) return
    const id = setInterval(() => dispatch({ type: 'tick', quiet: previewingRef.current }), 1000)
    return () => clearInterval(id)
  }, [state.timer.running, state.timer.paused])

  /* ---------- focus ---------- */

  const overlayOpen = !!state.palette || state.reader || (state.timer.running && state.timer.overlay)
  const wasOpen = useRef(overlayOpen)
  useLayoutEffect(() => {
    if (!wasOpen.current && overlayOpen && !previewingRef.current) {
      // An overlay opened over the chat, which is now inert. If focus was in
      // the chat (typing in the input when a break arrived), hold it on the
      // demo window so Escape still works. Overlays that take focus
      // themselves do so right after this.
      const active = document.activeElement
      const app = rootRef.current?.querySelector('.demo-app')
      if (app && (app.contains(active) || (active === document.body && app.contains(lastFocus.current)))) {
        windowRef.current?.focus({ preventScroll: true })
      }
    }
    if (wasOpen.current && !overlayOpen) {
      // An overlay closed. If focus went with it, put it back where it was.
      const active = document.activeElement
      const lost = !active || active === document.body || !rootRef.current?.contains(active)
      if (lost && !previewingRef.current) {
        const back = lastFocus.current
        const usable = back && back.isConnected && !back.closest('[inert]')
        ;(usable ? back : windowRef.current)?.focus({ preventScroll: true })
      }
    }
    wasOpen.current = overlayOpen
  }, [overlayOpen])

  // Hiding the input while typing in it (⌘⇧H or Zen from inside the field)
  // would drop focus to the page, and every later shortcut would silently do
  // nothing. Keep focus in the demo.
  useLayoutEffect(() => {
    if (!state.composerHidden) return
    const input = composerRef.current
    const active = document.activeElement
    // `inert` may already have blurred it to <body> by the time this runs.
    if (input && (active === input || (active === document.body && lastFocus.current === input))) {
      windowRef.current?.focus({ preventScroll: true })
    }
  }, [state.composerHidden])

  useEffect(() => {
    if (!state.composerHidden && focusComposer.current) {
      focusComposer.current = false
      const input = composerRef.current
      if (input) {
        input.focus({ preventScroll: true })
        const end = input.value.length
        input.setSelectionRange(end, end)
      }
    }
  }, [state.composerHidden])

  /* ---------- keys ---------- */

  // preventDefault only — the browser's own meaning of the key (redo, search)
  // is what must not fire. Nothing else on the page is kept from seeing it.
  function handled(e, action) {
    e.preventDefault()
    dispatch(action)
  }

  function onKeyDownCapture(e) {
    takeOver()
    const s = stateRef.current
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Escape') {
      if (isEscapable(s)) handled(e, { type: 'escape' })
      return
    }
    if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyK') return handled(e, { type: 'palette' })
    if (mod && e.shiftKey && !e.altKey && e.code === 'KeyZ') return handled(e, { type: 'zen' })
    if (mod && e.shiftKey && !e.altKey && e.code === 'KeyH') return handled(e, { type: 'composer' })

    // Type-ahead, as src/typeahead.js "auto": with the input hidden, a
    // printable key reveals it and lands in it. Space stays a scroll key.
    if (
      s.composerHidden && !overlayOpen && e.key.length === 1 && e.key !== ' ' &&
      !mod && !e.altKey && !isEditable(e.target)
    ) {
      focusComposer.current = true
      handled(e, { type: 'typeAhead', ch: e.key })
    }
  }

  function onFocusCapture(e) {
    takeOver()
    setKeysOn(true)
    if (!e.target.closest('.demo-pal, .demo-fr, .demo-pomo-screen')) lastFocus.current = e.target
  }

  function onBlurCapture(e) {
    if (!rootRef.current?.contains(e.relatedTarget)) setKeysOn(false)
  }

  const hint = touch
    ? 'try it: tap the buttons under the chat'
    : `try it: click the chat, then press ${keys('⌘K')}`

  const t = state.timer
  const announce = state.announce.text + (state.announce.n % 2 ? '​' : '')

  return (
    <div
      ref={rootRef}
      className="demo"
      onKeyDownCapture={onKeyDownCapture}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      onClickCapture={takeOver}
    >
      <p className="label demo-hint">{hint}</p>

      <div className="demo-frame">
        <div className="demo-chrome">
          <span className="demo-tl" aria-hidden="true" />
          <span className="demo-tl" aria-hidden="true" />
          <span className="demo-tl" aria-hidden="true" />
          <span className="demo-title">a pretend chat, with Calm</span>
          <span className="demo-status">
            {previewing ? (
              <button type="button" className="demo-stop" onClick={takeOver}>
                <span aria-hidden="true">■</span> Stop preview
              </button>
            ) : touch ? null : keysOn ? (
              <span className="demo-keys is-on"><span className="demo-keys-dot" aria-hidden="true" />keys on</span>
            ) : (
              <span className="demo-keys">click inside to use keys</span>
            )}
          </span>
        </div>

        <div
          ref={windowRef}
          className="demo-window"
          tabIndex={0}
          role="region"
          aria-label="Calm demo: a pretend AI chat"
          aria-describedby="demo-help"
        >
          <ChatWindow state={state} dispatch={dispatch} composerRef={composerRef} covered={overlayOpen} />

          {t.running && <TimeBar timer={t} />}
          {t.running && !t.overlay && (
            <TimerWidget timer={t} dispatch={dispatch} raised={!state.composerHidden} onExpand={() => { expandAsked.current = true }} />
          )}
          {state.reader && <FocusReader state={state} dispatch={dispatch} focusOnOpen={!previewing} />}
          {t.running && t.overlay && (
            // Focus moves in only when someone expanded it. A break arriving on
            // its own surfaces the screen without taking the keyboard away.
            <TimerOverlay timer={t} cycles={state.S.pomoCycles} dispatch={dispatch} focusOnOpen={!previewing && expandAsked.current} />
          )}
          {state.palette && <Palette state={state} dispatch={dispatch} focusOnOpen={!previewing} />}

          {keycap && (
            <div className="demo-keycap" aria-hidden="true" data-raised={!state.composerHidden && !overlayOpen}>
              {keycap.combo && <kbd>{keys(keycap.combo)}</kbd>}
              <span>{keycap.label}</span>
            </div>
          )}
        </div>
      </div>

      <Controls state={state} dispatch={dispatch} />

      <p className="demo-foot">
        {!touch && <>Esc closes what is open, then resets the demo. </>}
        Recreated for this page: not a real chat, and nothing you type is sent.
      </p>

      <p id="demo-help" className="sr-only">
        While this demo has focus: {keys('⌘K')} opens the command palette, {keys('⌘⇧Z')} toggles Zen,
        {' '}{keys('⌘⇧H')} hides or shows the input bar, and Escape closes what is open, then resets the demo.
        Every action also has a button under the chat.
      </p>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  )
}
