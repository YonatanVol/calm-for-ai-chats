import { useEffect, useRef } from 'react'
import { fmtTime, phaseLabel } from './state'

/**
 * The focus timer's three surfaces, as src/pomodoro.js draws them: a thin
 * time bar across the top (time as a shape), a compact ring widget that
 * expands, and the full focus screen with Pause · Skip · Reset · Minimize ·
 * End. The clock runs in real seconds; nothing here is sped up.
 */

function Ring({ size, frac }) {
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const cx = size / 2
  return (
    <svg className="demo-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="demo-ring-track" cx={cx} cy={cx} r={r} />
      <circle
        className="demo-ring-prog" cx={cx} cy={cx} r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, frac)))}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
    </svg>
  )
}

export function TimeBar({ timer }) {
  const brk = timer.phase === 'break' || timer.phase === 'long'
  const done = timer.total ? (1 - timer.remaining / timer.total) * 100 : 0
  return (
    <div className={`demo-timebar${brk ? ' is-break' : ''}`} aria-hidden="true">
      <div className="demo-timebar-fill" style={{ width: `${done}%` }} />
    </div>
  )
}

export function TimerWidget({ timer, dispatch, raised, onExpand, inert }) {
  const brk = timer.phase === 'break' || timer.phase === 'long'
  const frac = timer.total ? timer.remaining / timer.total : 0
  return (
    <button
      type="button"
      inert={inert}
      className={`demo-pomo${brk ? ' is-break' : ''}${raised ? ' is-raised' : ''}`}
      onClick={() => { onExpand?.(); dispatch({ type: 'timerOverlay', open: true }) }}
      aria-label={`${phaseLabel(timer.phase)}, ${fmtTime(timer.remaining)} left${timer.paused ? ', paused' : ''}. Expand the timer.`}
    >
      <span className="demo-pomo-ringwrap">
        <Ring size={46} frac={frac} />
        <span className="demo-pomo-time">{fmtTime(timer.remaining)}</span>
      </span>
      <span className="demo-pomo-meta" aria-hidden="true">
        <span className="demo-pomo-label">{phaseLabel(timer.phase)}</span>
        <span className="demo-pomo-expand">expand ⤢</span>
      </span>
    </button>
  )
}

export function TimerOverlay({ timer, cycles, dispatch, focusOnOpen, inert }) {
  const brk = timer.phase === 'break' || timer.phase === 'long'
  const frac = timer.total ? timer.remaining / timer.total : 0
  const first = useRef(null)
  useEffect(() => {
    if (focusOnOpen) first.current?.focus({ preventScroll: true })
  }, [focusOnOpen])
  return (
    <div className={`demo-pomo-screen${brk ? ' is-break' : ''}`} role="dialog" aria-label="Focus timer" inert={inert}>
      <div className="demo-pomo-card">
        <div className="demo-pomo-phase">{phaseLabel(timer.phase)}</div>
        <div className="demo-pomo-big">
          <Ring size={200} frac={frac} />
          <span className="demo-pomo-bigtime">{fmtTime(timer.remaining)}</span>
        </div>
        <div className="demo-pomo-dots" aria-label={`Block ${timer.cycle} of ${cycles}`} role="img">
          {Array.from({ length: cycles }, (_, i) => (
            <span key={i} className={`demo-dot${i + 1 <= timer.cycle ? ' is-on' : ''}`} />
          ))}
        </div>
        <div className="demo-pomo-controls">
          <button ref={first} type="button" className="demo-pomo-btn" aria-label={timer.paused ? 'Resume' : 'Pause'}
            onClick={() => dispatch({ type: 'timerPause' })}>
            {timer.paused ? '▶ Resume' : '❚❚ Pause'}
          </button>
          <button type="button" className="demo-pomo-btn" aria-label="Skip" onClick={() => dispatch({ type: 'timerSkip' })}>Skip ⤼</button>
          <button type="button" className="demo-pomo-btn" aria-label="Reset" onClick={() => dispatch({ type: 'timerReset' })}>Reset ↺</button>
          <button type="button" className="demo-pomo-btn" aria-label="Minimize" onClick={() => dispatch({ type: 'timerOverlay', open: false })}>Minimize ⤡</button>
          <button type="button" className="demo-pomo-btn is-end" aria-label="End" onClick={() => dispatch({ type: 'timerEnd' })}>End ✕</button>
        </div>
      </div>
    </div>
  )
}
