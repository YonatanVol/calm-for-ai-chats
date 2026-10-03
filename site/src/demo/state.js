/**
 * The demo's behaviour, as one reducer.
 *
 * Every rule here is ported from the extension rather than imagined, with the
 * source named beside it, because a demo that behaves differently from the
 * product teaches people the wrong thing:
 *
 *   Zen          src/modes.js     zenEnter / zenExit (the composer ownership)
 *   Input bar    src/core.js      hideComposer / showComposer / manualToggle
 *   Type-ahead   src/typeahead.js "auto": typing reveals and lands in the input
 *   Palette      src/palette.js   build / score / nudge / run
 *   Reader       src/reader.js    spotlight cursor, fixation 20–60
 *   Timer        src/pomodoro.js  start / tick / nextPhase / skip / reset / stop
 *   Presets      src/ui.js        the Advanced drawer's "Timer preset" map
 *
 * Every action may carry `quiet: true` (the autoplay preview): it changes the
 * state but announces nothing, so a screen reader is not narrated a video.
 */

export const PRESETS = {
  '10/2': { focus: 10, brk: 2, long: 10, name: 'Just 10 min (starter)' },
  '25/5': { focus: 25, brk: 5, long: 15, name: 'Classic 25/5' },
  '52/17': { focus: 52, brk: 17, long: 25, name: 'Deep 52/17' },
  '90/20': { focus: 90, brk: 20, long: 30, name: 'Ultra 90/20' },
}

// The subset of src/state.js defaultSettings the demo can honour.
export const DEFAULT_SETTINGS = {
  zenComposer: true,
  frBionic: true,
  frFixation: 40,
  frSize: 18,
  frEase: false,
  frSpotlight: false,
  pomoPreset: 'custom',
  pomoFocusMin: 25,
  pomoBreakMin: 5,
  pomoLongBreakMin: 15,
  pomoCycles: 4,
  pomoAutoZen: true,
}

const IDLE_TIMER = {
  phase: 'idle', remaining: 0, total: 0, cycle: 1,
  running: false, paused: false, enteredZen: false, overlay: false,
}

export const initialState = {
  S: DEFAULT_SETTINGS,
  zen: false,
  zenHidComposer: false,
  composerHidden: false,
  hiddenManually: false,
  draft: '',
  palette: null, // { query, cursor } while open
  reader: false,
  readerBlock: -1,
  timer: IDLE_TIMER,
  scroll: null, // { to: 'top' | 'end' | 'answer', n } — a request the chat view carries out
  sent: 0, // bumps when someone presses send, so the view can say nothing was sent
  announce: { text: '', n: 0 },
}

function say(s, text, action) {
  if (action.quiet || !text) return s
  return { ...s, announce: { text, n: s.announce.n + 1 } }
}

/* ---------------- input bar (src/core.js) ---------------- */

function hideComposer(s, opts = {}) {
  if (s.composerHidden) return s
  // An explicit hide is a decision; an automatic one is a guess.
  return { ...s, composerHidden: true, hiddenManually: !opts.auto }
}

function showComposer(s) {
  if (!s.composerHidden) return s
  // Zen's claim on the composer lasts exactly as long as Zen's hide does.
  return { ...s, composerHidden: false, hiddenManually: false, zenHidComposer: false }
}

/* ---------------- Zen (src/modes.js) ---------------- */

function zenEnter(s) {
  if (s.zen) return s
  let n = { ...s, zen: true }
  // Only claim the composer if it was visible.
  if (n.S.zenComposer && !n.composerHidden) {
    n = hideComposer({ ...n, zenHidComposer: true })
  }
  return n
}

function zenExit(s) {
  if (!s.zen) return s
  let n = { ...s, zen: false }
  // Restore what ZEN hid, never what the user chose to hide.
  if (n.zenHidComposer && n.composerHidden) n = showComposer(n)
  // A borrowed Zen is settled once Zen is off, by anyone's hand.
  return { ...n, zenHidComposer: false, timer: { ...n.timer, enteredZen: false } }
}

function zenMessage(before, after) {
  if (after.zen) {
    return after.composerHidden && !before.composerHidden
      ? 'Zen on. Sidebar, header, suggestions and the input bar are hidden.'
      : 'Zen on. Sidebar, header and suggestions are hidden.'
  }
  return before.composerHidden && !after.composerHidden
    ? 'Zen off. Everything is back, including the input bar.'
    : 'Zen off. Sidebar, header and suggestions are back.'
}

/* ---------------- timer (src/pomodoro.js) ---------------- */

function minsFor(S, phase) {
  return phase === 'focus' ? S.pomoFocusMin : phase === 'long' ? S.pomoLongBreakMin : S.pomoBreakMin
}

function enterPhase(s, phase) {
  const total = Math.max(1, minsFor(s.S, phase) | 0) * 60
  return { ...s, timer: { ...s.timer, phase, total, remaining: total } }
}

function timerStart(s) {
  if (s.timer.running) return s
  let n = { ...s, timer: { ...s.timer, cycle: 1, paused: false, enteredZen: false, overlay: false } }
  n = enterPhase(n, 'focus')
  // Adopt Zen only if WE are the one turning it on.
  if (n.S.pomoAutoZen && !n.zen) {
    n = zenEnter(n)
    n = { ...n, timer: { ...n.timer, enteredZen: true } }
  }
  return { ...n, timer: { ...n.timer, running: true } }
}

function timerStop(s) {
  if (!s.timer.running && s.timer.phase === 'idle') return s
  let n = s
  // Leave no Zen behind that WE turned on.
  if (n.timer.enteredZen && n.zen) n = zenExit(n)
  // Like pomodoro.js stop(): the clock itself is left where it stood (nothing
  // shows it once the timer is gone) — only the phase and the flags reset.
  // (pomodoro.js stop() does not clear `paused` either; start() does.)
  return { ...n, timer: { ...n.timer, running: false, phase: 'idle', overlay: false, enteredZen: false } }
}

function nextPhase(s) {
  let n = s
  if (n.timer.phase === 'focus') {
    const longNow = n.timer.cycle >= (n.S.pomoCycles | 0)
    n = enterPhase(n, longNow ? 'long' : 'break')
    // Reveal on break, but only exit the Zen we enabled.
    if (n.timer.enteredZen && n.zen) n = zenExit(n)
    return { ...n, timer: { ...n.timer, enteredZen: false, overlay: true } }
  }
  // The whole set is done. pomodoro.js refills the clock before exiting.
  if (n.timer.phase === 'long') return timerStop({ ...n, timer: { ...n.timer, remaining: n.timer.total } })
  n = { ...n, timer: { ...n.timer, cycle: n.timer.cycle + 1 } }
  n = enterPhase(n, 'focus')
  if (n.S.pomoAutoZen && !n.zen) {
    n = zenEnter(n)
    n = { ...n, timer: { ...n.timer, enteredZen: true } }
  }
  return { ...n, timer: { ...n.timer, overlay: false } }
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const ss = sec % 60
  return m + ':' + (ss < 10 ? '0' + ss : ss)
}

export function phaseLabel(phase) {
  return phase === 'focus' ? 'Focus' : phase === 'break' ? 'Break' : phase === 'long' ? 'Long break' : ''
}

/* ---------------- palette (src/palette.js) ---------------- */

// Only settings the demo can actually honour are listed; the palette says so.
const RANGES = {
  frFixation: [20, 60, 5],
  frSize: [15, 26, 1],
  pomoFocusMin: [5, 90, 1],
  pomoBreakMin: [1, 20, 1],
}
const TOGGLES = ['zenComposer', 'frBionic', 'frEase', 'frSpotlight', 'pomoAutoZen']
// defaultSettings order, which is the order the extension lists them in.
const SETTING_ORDER = ['zenComposer', 'frBionic', 'frFixation', 'frSize', 'frEase', 'frSpotlight', 'pomoFocusMin', 'pomoBreakMin', 'pomoAutoZen']

function title(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (m) => m.toUpperCase())
    .replace(/\bPomo\b/, 'Pomodoro')
    .replace(/\bFr\b/, 'Reader')
}

export function paletteItems() {
  const items = [
    { kind: 'action', id: 'input', name: 'Toggle the input bar', hint: '⌃⇧H' },
    { kind: 'action', id: 'top', name: 'Scroll to top' },
    { kind: 'action', id: 'end', name: 'Scroll to end' },
    { kind: 'action', id: 'answer', name: 'Back to the start of the answer', hint: '⌃⇧J' },
    { kind: 'mode', id: 'zen', name: 'Zen' },
    { kind: 'mode', id: 'focusreader', name: 'Focus Reader' },
    { kind: 'mode', id: 'pomodoro', name: 'Pomodoro' },
  ]
  SETTING_ORDER.forEach((k) => {
    if (TOGGLES.includes(k)) items.push({ kind: 'toggle', key: k, name: title(k) })
    else items.push({ kind: 'range', key: k, name: title(k), range: RANGES[k] })
  })
  return items
}

const ITEMS = paletteItems()

// Subsequence match, so "rdr" finds "Reader…".
export function score(name, q) {
  if (!q) return 0
  const n = name.toLowerCase()
  const i = n.indexOf(q)
  if (i >= 0) return 100 - i
  let qi = 0
  for (let c = 0; c < n.length && qi < q.length; c++) {
    if (n.charAt(c) === q.charAt(qi)) qi++
  }
  return qi === q.length ? 10 : -1
}

export function filterItems(query) {
  const q = (query || '').trim().toLowerCase()
  return ITEMS
    .map((it) => ({ it, s: score(it.name, q) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it)
    .slice(0, 8)
}

export function stateOf(s, it) {
  if (it.kind === 'mode') return modeOn(s, it.id) ? 'on' : ''
  if (it.kind === 'toggle') return s.S[it.key] ? 'on' : 'off'
  if (it.kind === 'range') return String(s.S[it.key])
  return it.hint || ''
}

function modeOn(s, id) {
  return id === 'zen' ? s.zen : id === 'focusreader' ? s.reader : id === 'pomodoro' ? s.timer.running : false
}

/* ---------------- the reducer ---------------- */

export function reducer(s, a) {
  switch (a.type) {
    case 'zen': {
      const n = s.zen ? zenExit(s) : zenEnter(s)
      return say(n, zenMessage(s, n), a)
    }

    case 'composer': {
      const n = s.composerHidden ? showComposer(s) : hideComposer(s)
      return say(n, n.composerHidden ? 'Input bar hidden. Start typing to bring it back.' : 'Input bar shown.', a)
    }

    case 'typeAhead': {
      if (!s.composerHidden) return s
      const n = { ...showComposer(s), draft: s.draft + a.ch }
      return say(n, 'Input bar back, with what you typed in it.', a)
    }

    // ⌘⇧J in the extension (src/core.js jumpToAnswerStart), and the palette's
    // "Back to the start of the answer".
    case 'answerTop':
      return say({ ...s, scroll: { to: 'answer', n: (s.scroll?.n || 0) + 1 } }, 'Back to the start of the answer.', a)

    case 'draft':
      return { ...s, draft: a.value }

    case 'send':
      return say({ ...s, sent: s.sent + 1 }, 'This is a demo. Nothing is sent anywhere.', a)

    case 'palette': {
      if (s.palette) return { ...s, palette: null }
      return say({ ...s, palette: { query: '', cursor: 0 } }, 'Command palette. Type to search, arrow keys to move, Return to run.', a)
    }

    case 'paletteClose':
      return s.palette ? { ...s, palette: null } : s

    case 'paletteQuery':
      return s.palette ? { ...s, palette: { query: a.query, cursor: 0 } } : s

    case 'paletteMove': {
      if (!s.palette) return s
      const count = filterItems(s.palette.query).length
      const cursor = a.dir > 0
        ? Math.min(Math.max(count - 1, 0), s.palette.cursor + 1)
        : Math.max(0, s.palette.cursor - 1)
      return { ...s, palette: { ...s.palette, cursor } }
    }

    case 'paletteNudge': {
      if (!s.palette) return s
      const it = filterItems(s.palette.query)[s.palette.cursor]
      if (!it || it.kind !== 'range') return s
      const [min, max, step] = it.range
      const v = Math.max(min, Math.min(max, (s.S[it.key] | 0) + a.dir * step))
      const n = { ...s, S: { ...s.S, [it.key]: v } }
      return say(n, `${it.name} ${v}`, a)
    }

    case 'paletteRun': {
      if (!s.palette) return s
      const cursor = a.index ?? s.palette.cursor
      const it = filterItems(s.palette.query)[cursor]
      if (!it) return s
      if (it.kind === 'range') return { ...s, palette: { ...s.palette, cursor } } // adjusted with the arrows, not entered
      const closed = { ...s, palette: null }
      if (it.kind === 'toggle') {
        const v = !s.S[it.key]
        return say({ ...closed, S: { ...s.S, [it.key]: v } }, `${it.name} ${v ? 'on' : 'off'}.`, a)
      }
      if (it.id === 'input') return reducer(closed, { ...a, type: 'composer' })
      if (it.id === 'zen') return reducer(closed, { ...a, type: 'zen' })
      if (it.id === 'focusreader') return reducer(closed, { ...a, type: 'reader' })
      if (it.id === 'pomodoro') return reducer(closed, { ...a, type: closed.timer.running ? 'timerEnd' : 'timerStart' })
      return { ...closed, scroll: { to: it.id, n: (s.scroll?.n || 0) + 1 } }
    }

    case 'reader': {
      if (s.reader) return say({ ...s, reader: false, readerBlock: -1 }, 'Focus Reader closed.', a)
      const n = { ...s, reader: true, readerBlock: s.S.frSpotlight ? 0 : -1 }
      return say(n, `Focus Reader open. Fixation ${s.S.frFixation} percent. Escape closes it.`, a)
    }

    case 'readerSet': {
      let n = { ...s, S: { ...s.S, [a.key]: a.value } }
      if (a.key === 'frSpotlight' && a.value) n = { ...n, readerBlock: s.readerBlock < 0 ? 0 : s.readerBlock }
      const labels = { frBionic: 'Bionic', frEase: 'Ease', frSpotlight: 'Spotlight' }
      return labels[a.key] ? say(n, `${labels[a.key]} ${a.value ? 'on' : 'off'}.`, a) : n
    }

    case 'readerBlock': {
      if (!s.reader || !s.S.frSpotlight) return s
      const i = a.index != null ? a.index : s.readerBlock + a.dir
      const next = Math.max(0, Math.min(a.count - 1, i))
      // Hovering within the same block must not re-render (and re-fixate)
      // the whole demo on every mouse move.
      return next === s.readerBlock ? s : { ...s, readerBlock: next }
    }

    case 'preset': {
      const p = PRESETS[a.key]
      let n = timerStop(s)
      n = { ...n, S: { ...n.S, pomoPreset: a.key, pomoFocusMin: p.focus, pomoBreakMin: p.brk, pomoLongBreakMin: p.long } }
      const zenBefore = n.zen
      n = timerStart(n)
      const zenNote = n.zen && !zenBefore ? ' Zen is on until the break.' : ''
      return say(n, `Focus timer started: ${p.name}, ${p.focus} minutes of focus.${zenNote}`, a)
    }

    case 'timerStart': {
      const n = timerStart(s)
      return say(n, `Focus timer started: ${n.S.pomoFocusMin} minutes of focus.${n.zen && !s.zen ? ' Zen is on until the break.' : ''}`, a)
    }

    case 'tick': {
      const t = s.timer
      if (!t.running || t.paused) return s
      if (t.remaining - 1 > 0) return { ...s, timer: { ...t, remaining: t.remaining - 1 } }
      const n = nextPhase({ ...s, timer: { ...t, remaining: 0 } })
      return say(n, n.timer.running ? `${phaseLabel(n.timer.phase)}, ${fmtTime(n.timer.remaining)}.` : 'Focus timer finished.', a)
    }

    case 'timerPause': {
      if (!s.timer.running) return s // only reachable from the running timer
      const n = { ...s, timer: { ...s.timer, paused: !s.timer.paused } }
      return say(n, n.timer.paused ? 'Timer paused.' : 'Timer running.', a)
    }

    case 'timerSkip': {
      if (!s.timer.running) return s
      const n = nextPhase({ ...s, timer: { ...s.timer, remaining: 0 } })
      return say(n, n.timer.running ? `Skipped to ${phaseLabel(n.timer.phase).toLowerCase()}, ${fmtTime(n.timer.remaining)}.` : 'Focus timer finished.', a)
    }

    case 'timerReset': {
      if (!s.timer.running) return s
      let n = { ...s, timer: { ...s.timer, cycle: 1, paused: false } }
      n = enterPhase(n, 'focus')
      return say(n, `Timer reset to ${fmtTime(n.timer.remaining)}.`, a)
    }

    case 'timerOverlay':
      return s.timer.running ? { ...s, timer: { ...s.timer, overlay: a.open } } : s

    case 'timerEnd': {
      if (!s.timer.running) return s
      return say(timerStop(s), 'Focus timer ended.', a)
    }

    // Escape peels one layer at a time, from the top of the stack down: the
    // palette, then the timer's full screen, then Focus Reader — what you
    // can see, in the order you can see it. With nothing left open it resets
    // the demo.
    //
    // The extension differs here, deliberately: there, Escape closes the
    // palette and Focus Reader but has no handler on the timer screen, and it
    // never leaves Zen or shows the input. The note under the demo says Esc
    // resets the demo, and the README lists both as demo-only.
    case 'escape': {
      if (s.palette) return { ...s, palette: null }
      if (s.timer.overlay) return { ...s, timer: { ...s.timer, overlay: false } }
      if (s.reader) return reducer(s, { ...a, type: 'reader' })
      if (s.zen || s.composerHidden || s.timer.running) {
        return say(reset(s), 'Demo reset. Everything is back.', a)
      }
      return s
    }

    case 'reset':
      return a.full ? { ...initialState, announce: s.announce } : reset(s)

    default:
      return s
  }
}

// Leave every mode, keep the settings someone chose.
function reset(s) {
  return {
    ...initialState,
    S: s.S,
    draft: s.draft,
    announce: s.announce,
    sent: s.sent,
  }
}

export function isEscapable(s) {
  return !!(s.palette || s.reader || s.timer.overlay || s.zen || s.composerHidden || s.timer.running)
}
