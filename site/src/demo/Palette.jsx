import { useEffect, useRef } from 'react'
import { filterItems, stateOf } from './state'
import { keys } from '../lib/platform'

/**
 * The command palette, as src/palette.js builds it: a CALM tag, one search
 * field, at most eight rows, ↑↓ to move, ←→ to nudge a number in place,
 * Return to run, Escape to close. Rows that hold a number are adjusted, not
 * run — pressing Return on one does nothing, exactly as in the extension.
 *
 * Unlike the extension it is a proper combobox (the extension's rows are
 * plain divs), and it says honestly that it lists only what this demo can do.
 */
export default function Palette({ state, dispatch, focusOnOpen }) {
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const { query, cursor } = state.palette
  const rows = filterItems(query)

  useEffect(() => {
    if (focusOnOpen) inputRef.current?.focus({ preventScroll: true })
  }, [focusOnOpen])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [cursor, query])

  function onKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) return // the input method owns these
    if (e.key === 'ArrowDown') { e.preventDefault(); dispatch({ type: 'paletteMove', dir: 1 }) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); dispatch({ type: 'paletteMove', dir: -1 }) }
    else if (e.key === 'ArrowRight' && rows[cursor]?.kind === 'range') { e.preventDefault(); dispatch({ type: 'paletteNudge', dir: 1 }) }
    else if (e.key === 'ArrowLeft' && rows[cursor]?.kind === 'range') { e.preventDefault(); dispatch({ type: 'paletteNudge', dir: -1 }) }
    else if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'paletteRun' }) }
  }

  return (
    <div
      className="demo-pal"
      onPointerDown={(e) => { if (e.target === e.currentTarget) dispatch({ type: 'paletteClose' }) }}
    >
      <div className="demo-pal-box" role="dialog" aria-label="Calm command palette">
        <div className="demo-pal-top">
          <span className="demo-pal-tag" aria-hidden="true">CALM</span>
          <input
            ref={inputRef}
            className="demo-pal-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="demo-pal-list"
            aria-autocomplete="list"
            aria-activedescendant={rows.length ? `demo-pal-row-${cursor}` : undefined}
            aria-label="Search Calm"
            placeholder="Search modes, actions, settings…"
            autoComplete="off"
            spellCheck="false"
            value={query}
            onChange={(e) => dispatch({ type: 'paletteQuery', query: e.target.value })}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="demo-pal-list" id="demo-pal-list" role="listbox" aria-label="Commands" ref={listRef}>
          {rows.map((it, i) => {
            const on = i === cursor
            const st = stateOf(state, it)
            const hint = it.kind === 'action' && st ? keys(st) : st
            return (
              <div
                key={it.name}
                id={`demo-pal-row-${i}`}
                role="option"
                aria-selected={on}
                className={`demo-pal-row${on ? ' is-on' : ''}`}
                onPointerDown={(e) => e.preventDefault() /* keep focus in the search field */}
                onClick={() => dispatch({ type: 'paletteRun', index: i })}
              >
                <span>{it.name}</span>
                <span className="demo-pal-state">
                  {hint}
                  {it.kind === 'range' && on ? <span className="demo-pal-arrows" aria-hidden="true">{'← →'}</span> : null}
                </span>
              </div>
            )
          })}
        </div>
        {!rows.length && <p className="demo-pal-empty">Nothing matches</p>}
        {rows[cursor]?.kind === 'range' && (
          // The extension nudges a number with ← and →. A touch screen has
          // neither, so the selected number also gets a pair of buttons —
          // outside the list, because an option may not contain controls.
          <div className="demo-pal-nudgebar">
            <span>{rows[cursor].name}</span>
            <button type="button" className="demo-pal-nudge" aria-label={`Decrease ${rows[cursor].name}`}
              onClick={() => dispatch({ type: 'paletteNudge', dir: -1 })}>−</button>
            <span className="demo-pal-nudgeval">{state.S[rows[cursor].key]}</span>
            <button type="button" className="demo-pal-nudge" aria-label={`Increase ${rows[cursor].name}`}
              onClick={() => dispatch({ type: 'paletteNudge', dir: 1 })}>+</button>
          </div>
        )}
        <p className="demo-pal-note">A few of Calm's commands, the ones this demo can run.</p>
      </div>
    </div>
  )
}
