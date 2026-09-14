// The demo claims to behave like the extension. This holds it to that, by
// reading the extension's own source rather than a copy of what it says.
//
//   npm test                         compare with ../src (the working tree)
//   CALM_REF=v3.2.1 npm test         compare with a release tag instead
//
// The release matters: the page describes what people download, which can be
// behind develop.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { boldCount, safeCut, fixate } from '../src/lib/bionic.js'
import { DEFAULT_SETTINGS, PRESETS, paletteItems, score, filterItems, initialState, reducer } from '../src/demo/state.js'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REF = process.env.CALM_REF
const src = (rel) => (REF
  ? execFileSync('git', ['-C', REPO, 'show', `${REF}:${rel}`], { encoding: 'utf8' })
  : readFileSync(join(REPO, rel), 'utf8'))

// Pull `function name(...) { ... }` out of an IIFE by matching braces.
function extract(text, name) {
  const start = text.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `function ${name} not found in extension source`)
  let depth = 0
  for (let i = text.indexOf('{', start); i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  throw new Error(`unbalanced ${name}`)
}
const load = (text, ...names) =>
  new Function(`${names.map((n) => extract(text, n)).join('\n')}; return { ${names.join(', ')} };`)()

const reader = src('src/reader.js')
const palette = src('src/palette.js')
const ext = { ...load(reader, 'boldCount', 'safeCut'), ...load(palette, 'score', 'title') }

const CORPUS = [
  'This sentence is set the way Calm sets one. The bold openings are fixation points — your eye lands, recognises the word, and moves on.',
  'A long answer asks you to hold several ideas at once: a sidebar, suggestions, the box.',
  'קריאה נעשית קלה יותר כשיש פחות רעש סביב הטקסט, והעין יודעת איפה לנחות בכל מילה.',
  'בְּרֵאשִׁית בָּרָא אֱלֹהִים', // niqqud: combining marks after the cut
  'السَّلَامُ عَلَيْكُمْ', // harakat
  'a I ok 👋🏽hello 𝒳y éclair',
]

test('bionic split matches src/reader.js at every fixation 20–60', () => {
  for (let pct = 20; pct <= 60; pct++) {
    const frac = pct / 100
    for (const text of CORPUS) {
      const theirs = text.split(/(\s+)/).filter(Boolean).map((tok) => {
        if (/^\s+$/.test(tok)) return [null, tok]
        const cut = ext.safeCut(tok, ext.boldCount(tok.length, frac))
        return [tok.slice(0, cut), tok.slice(cut)]
      })
      assert.deepEqual(fixate(text, frac), theirs, `${pct}%: ${text.slice(0, 30)}`)
    }
    for (let len = 0; len < 30; len++) assert.equal(boldCount(len, frac), ext.boldCount(len, frac))
  }
  assert.equal(safeCut('בְּ', 1), ext.safeCut('בְּ', 1))
})

test('palette names, ranges and search scoring match src/palette.js', () => {
  const items = paletteItems()
  const names = items.map((it) => it.name)
  for (const it of items) {
    if (it.kind === 'action') assert.match(palette, new RegExp(`name: "${it.name}"`), `action "${it.name}"`)
    if (it.kind === 'action' && it.hint) assert.match(palette, new RegExp(`name: "${it.name}",\\s*hint: "${it.hint}"`), `hint for "${it.name}"`)
    if (it.key) assert.equal(it.name, ext.title(it.key), `title for ${it.key}`)
    if (it.kind === 'range') {
      const m = palette.match(new RegExp(`${it.key}: \\[(\\d+), (\\d+), (\\d+)\\]`))
      assert.ok(m, `range for ${it.key}`)
      assert.deepEqual(it.range, m.slice(1).map(Number), `range for ${it.key}`)
    }
  }
  const modes = src('src/modes.js')
  for (const it of items.filter((x) => x.kind === 'mode')) assert.match(modes, new RegExp(`label: "${it.name}"`), `mode "${it.name}"`)
  for (const q of ['', 'f', 'foc', 'rdr', 'zen', 'pomo', 'fix', 'input', 'xyz', 'r f']) {
    for (const n of names) assert.equal(score(n, q.trim().toLowerCase()), ext.score(n, q.trim().toLowerCase()), `score("${n}", "${q}")`)
  }
  assert.equal(filterItems('foc')[0].name, 'Focus Reader')
})

test('timer presets and defaults match src/ui.js and src/state.js', () => {
  const ui = src('src/ui.js')
  for (const [key, p] of Object.entries(PRESETS)) {
    assert.match(ui, new RegExp(`"${key}": \\[${p.focus}, ${p.brk}, ${p.long}\\]`), `preset ${key}`)
    assert.match(ui, new RegExp(`value: "${key}", label: "${p.name.replace(/[()]/g, '\\$&')}"`), `preset label ${key}`)
  }
  const state = src('src/state.js')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const m = state.match(new RegExp(`\\b${key}: ([^,]+),`))
    assert.ok(m, `default ${key}`)
    assert.equal(m[1].trim(), JSON.stringify(value).replace(/"/g, '"'), `default ${key}`)
  }
  assert.match(reader, /slider\(20, 60,/, 'fixation slider runs 20–60')
  assert.match(reader, /slider\(15, 26,/, 'text size slider runs 15–26')
})

/* ---------- behaviour: the rules the reducer ports ---------- */

const run = (...actions) => actions.reduce((s, a) => reducer(s, typeof a === 'string' ? { type: a } : a), initialState)

test('Zen hides the input bar and gives back only what it hid', () => {
  let s = run('zen')
  assert.equal(s.zen, true)
  assert.equal(s.composerHidden, true)
  assert.equal(run('zen', 'zen').composerHidden, false)

  // I hid it myself first: leaving Zen must not bring it back.
  s = run('composer', 'zen', 'zen')
  assert.equal(s.composerHidden, true)

  // I brought it back during Zen: leaving Zen must not hide it again.
  s = run('zen', 'composer', 'zen')
  assert.equal(s.composerHidden, false)

  // Zen without the composer setting leaves the input alone.
  s = reducer({ ...initialState, S: { ...initialState.S, zenComposer: false } }, { type: 'zen' })
  assert.equal(s.composerHidden, false)
})

test('typing with the input hidden brings it back with the letter in it', () => {
  const s = run('composer', { type: 'typeAhead', ch: 'H' }, { type: 'typeAhead', ch: 'i' })
  assert.equal(s.composerHidden, false)
  assert.equal(s.draft, 'H') // the second key arrives with the input already open
  assert.equal(run({ type: 'typeAhead', ch: 'x' }).draft, '')
})

test('a focus block borrows Zen and returns it; a Zen I chose stays', () => {
  let s = run({ type: 'preset', key: '25/5' })
  assert.equal(s.timer.running, true)
  assert.equal(s.timer.remaining, 25 * 60)
  assert.equal(s.zen, true)
  assert.equal(run({ type: 'preset', key: '25/5' }, 'timerEnd').zen, false)

  s = run('zen', { type: 'preset', key: '52/17' }, 'timerEnd')
  assert.equal(s.zen, true)

  // I left Zen mid-block, then turned it on again: that Zen is mine now.
  s = run({ type: 'preset', key: '10/2' }, 'zen', 'zen', 'timerEnd')
  assert.equal(s.zen, true)
})

test('the end of a focus block starts the break, releases Zen and shows the timer', () => {
  let s = run({ type: 'preset', key: '10/2' })
  s = { ...s, timer: { ...s.timer, remaining: 1 } }
  s = reducer(s, { type: 'tick' })
  assert.equal(s.timer.phase, 'break')
  assert.equal(s.timer.remaining, 2 * 60)
  assert.equal(s.timer.overlay, true)
  assert.equal(s.zen, false)
  // Skip through a break: the next focus block borrows Zen again.
  s = reducer(s, { type: 'timerSkip' })
  assert.equal(s.timer.phase, 'focus')
  assert.equal(s.timer.cycle, 2)
  assert.equal(s.zen, true)
})

test('palette: Return runs and closes; a number row stays open and nudges within range', () => {
  let s = run('palette', { type: 'paletteQuery', query: 'foc' }, 'paletteRun')
  assert.equal(s.palette, null)
  assert.equal(s.reader, true)

  s = run('palette', { type: 'paletteQuery', query: 'fixation' }, 'paletteRun')
  assert.ok(s.palette, 'a range row is adjusted, not run')
  for (let i = 0; i < 10; i++) s = reducer(s, { type: 'paletteNudge', dir: 1 })
  assert.equal(s.S.frFixation, 60)
  for (let i = 0; i < 20; i++) s = reducer(s, { type: 'paletteNudge', dir: -1 })
  assert.equal(s.S.frFixation, 20)

  s = run('palette', { type: 'paletteMove', dir: -1 })
  assert.equal(s.palette.cursor, 0)
  s = run('palette', { type: 'paletteQuery', query: 'qqqq' }, { type: 'paletteMove', dir: 1 })
  assert.equal(s.palette.cursor, 0, 'no rows: the cursor never goes negative')
})

test('Escape peels one layer at a time, then resets the demo', () => {
  let s = run({ type: 'preset', key: '25/5' }, { type: 'timerOverlay', open: true }, 'reader', 'palette')
  s = reducer(s, { type: 'escape' })
  assert.equal(s.palette, null)
  assert.equal(s.reader, true)
  s = reducer(s, { type: 'escape' })
  assert.equal(s.reader, false)
  assert.equal(s.timer.overlay, true)
  s = reducer(s, { type: 'escape' })
  assert.equal(s.timer.overlay, false)
  assert.equal(s.timer.running, true)
  s = reducer(s, { type: 'escape' })
  assert.equal(s.timer.running, false)
  assert.equal(s.zen, false)
  assert.equal(s.composerHidden, false)
})

test('the preview is never announced; a person is', () => {
  assert.equal(reducer(initialState, { type: 'zen', quiet: true }).announce.text, '')
  assert.match(reducer(initialState, { type: 'zen' }).announce.text, /^Zen on/)
})
