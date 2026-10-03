import { useEffect, useRef } from 'react'
import { ANSWER } from './content'
import { fixate } from '../lib/bionic'

/**
 * Focus Reader, as src/reader.js builds it: the latest answer lifted into a
 * pane of Calm's own, a toolbar of Bionic · fixation · text size · Ease ·
 * Spotlight · close, every block `dir="auto"` so each paragraph finds its own
 * direction, and ↑↓ walking the spotlight.
 *
 * Two deliberate differences, both for contrast: the extension dims
 * non-current blocks to 22% opacity and draws its brand in 32% ink, which
 * measure well under WCAG AA. Here the receding blocks turn grey instead
 * (5.3:1) and the brand uses the site's lifted faint grey. A small number
 * beside the fixation slider says the value, which the extension leaves to
 * the slider's tooltip.
 */
export default function FocusReader({ state, dispatch, focusOnOpen, inert }) {
  const paneRef = useRef(null)
  const S = state.S
  const frac = (S.frFixation | 0) / 100 || 0.4

  useEffect(() => {
    if (focusOnOpen) paneRef.current?.focus({ preventScroll: true })
  }, [focusOnOpen])

  useEffect(() => {
    if (state.readerBlock < 0 || !S.frSpotlight) return
    const el = paneRef.current?.querySelector(`[data-blk="${state.readerBlock}"]`)
    el?.scrollIntoView?.({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [state.readerBlock, S.frSpotlight])

  const set = (key, value) => dispatch({ type: 'readerSet', key, value })

  return (
    <div
      ref={paneRef}
      className={`demo-fr${S.frEase ? ' is-ease' : ''}${S.frSpotlight ? ' is-spot' : ''}`}
      role="dialog"
      aria-label="Focus Reader"
      tabIndex={-1}
      inert={inert}
      onKeyDown={(e) => {
        if (!S.frSpotlight) return
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (e.target.tagName === 'INPUT') return // a focused slider owns its arrows
          e.preventDefault()
          dispatch({ type: 'readerBlock', dir: e.key === 'ArrowDown' ? 1 : -1, count: ANSWER.length })
        }
      }}
    >
      <div className="demo-fr-bar">
        <span className="demo-fr-brand">Focus Reader</span>
        <div className="demo-fr-tools">
          <Chip on={S.frBionic} onClick={() => set('frBionic', !S.frBionic)}>Bionic</Chip>
          <label className="demo-fr-slider">
            <span className="sr-only">Fixation strength</span>
            <input
              type="range" min="20" max="60" value={S.frFixation}
              title="Fixation strength"
              aria-valuetext={`${S.frFixation} percent`}
              onChange={(e) => set('frFixation', parseInt(e.target.value, 10))}
            />
            <span className="demo-fr-val" aria-hidden="true">{S.frFixation}%</span>
          </label>
          <label className="demo-fr-slider">
            <span className="sr-only">Text size</span>
            <input
              type="range" min="15" max="26" value={S.frSize}
              title="Text size"
              aria-valuetext={`${S.frSize} pixels`}
              onChange={(e) => set('frSize', parseInt(e.target.value, 10))}
            />
          </label>
          <Chip on={S.frEase} onClick={() => set('frEase', !S.frEase)}>Ease</Chip>
          <Chip on={S.frSpotlight} onClick={() => set('frSpotlight', !S.frSpotlight)}>Spotlight</Chip>
          <button type="button" className="demo-fr-ic" aria-label="Close Focus Reader" title="Close (Esc)"
            onClick={() => dispatch({ type: 'reader' })}>
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      <div className="demo-fr-body" style={{ fontSize: `${S.frSize | 0}px` }}>
        {ANSWER.map((b, i) => {
          const Tag = b.tag
          const on = S.frSpotlight && i === state.readerBlock
          return (
            <Tag
              key={i}
              dir="auto"
              data-blk={i}
              className={`demo-fr-blk${on ? ' is-on' : ''}`}
              onMouseOver={() => { if (S.frSpotlight) dispatch({ type: 'readerBlock', index: i, count: ANSWER.length }) }}
            >
              {S.frBionic
                ? fixate(b.text, frac).map(([bold, rest], j) =>
                    bold === null ? rest : <span key={j}><b className="demo-fx">{bold}</b>{rest}</span>)
                : b.text}
            </Tag>
          )
        })}
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return (
    <button type="button" className={`demo-fr-btn${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}
