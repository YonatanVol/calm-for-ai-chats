import { useEffect, useRef, useState } from 'react'
import { ANSWER, CHIPS, HISTORY, QUESTION, TITLE } from './content'

/**
 * A pretend AI chat. Generic on purpose — no service's name, logo, colours or
 * layout quirks — so it can only ever read as "a chat", never as someone
 * else's product.
 *
 * The parts Calm acts on are marked: Zen collapses the sidebar, header and
 * suggestion chips; the input bar collapses on its own. Hidden parts are
 * `inert`, so nothing invisible can take keyboard focus.
 */
export default function ChatWindow({ state, dispatch, composerRef, covered }) {
  const scrollRef = useRef(null)
  const answerRef = useRef(null)
  const [sentNote, setSentNote] = useState(false)
  const zen = state.zen

  useEffect(() => {
    const sc = scrollRef.current
    if (!sc || !state.scroll) return
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    const answer = answerRef.current
    const top =
      state.scroll.to === 'top' ? 0
      : state.scroll.to === 'end' ? sc.scrollHeight
      // Relative to the scroller, not to the window: offsetTop counts the
      // header too and would overshoot by its height.
      : answer ? sc.scrollTop + answer.getBoundingClientRect().top - sc.getBoundingClientRect().top - 16
      : 0
    sc.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
  }, [state.scroll])

  useEffect(() => {
    if (!state.sent) return
    setSentNote(true)
    const t = setTimeout(() => setSentNote(false), 2600)
    return () => clearTimeout(t)
  }, [state.sent])

  return (
    <div className="demo-app" data-zen={zen} inert={covered || undefined}>
      <aside className="demo-side" inert={zen || undefined} aria-label="Conversations">
        <div className="demo-side-new">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
          New conversation
        </div>
        <p className="demo-side-h">Recent</p>
        <ul className="demo-side-list">
          <li className="is-on">{TITLE}</li>
          {HISTORY.map((h) => <li key={h} dir="auto">{h}</li>)}
        </ul>
      </aside>

      <div className="demo-main">
        <div className="demo-collapse" data-hidden={zen} inert={zen || undefined}>
          <div>
            <header className="demo-head">
              <svg className="demo-head-menu" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>
              <span className="demo-head-title">{TITLE}</span>
              <span className="demo-head-count">4 messages</span>
            </header>
          </div>
        </div>

        <div className="demo-convo" ref={scrollRef}>
          <div className="demo-convo-inner">
            <p className="demo-user">{QUESTION}</p>
            <div className="demo-answer" ref={answerRef}>
              {ANSWER.map((b, i) => {
                const Tag = b.tag
                return <Tag key={i} dir="auto">{b.text}</Tag>
              })}
            </div>
          </div>
        </div>

        <div className="demo-collapse" data-hidden={zen} inert={zen || undefined}>
          <div>
            <ul className="demo-chips" aria-label="Suggestions">
              {CHIPS.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        </div>

        <div className="demo-collapse" data-hidden={state.composerHidden} inert={state.composerHidden || undefined}>
          <div>
            <form
              className="demo-composer"
              onSubmit={(e) => { e.preventDefault(); dispatch({ type: 'send' }) }}
            >
              <input
                ref={composerRef}
                className="demo-composer-input"
                type="text"
                dir="auto"
                aria-label="Message (demo — nothing is sent)"
                placeholder="Message the assistant…"
                autoComplete="off"
                value={state.draft}
                onChange={(e) => dispatch({ type: 'draft', value: e.target.value })}
              />
              <button type="submit" className="demo-send">Send</button>
            </form>
            <p className={`demo-sent${sentNote ? ' is-on' : ''}`} aria-hidden="true">This is a demo. Nothing is sent anywhere.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
