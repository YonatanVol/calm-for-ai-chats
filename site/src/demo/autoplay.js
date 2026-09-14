/**
 * The preview: a quiet loop through every feature, like a video, until
 * someone touches the demo. Each step dispatches the same actions a person
 * would, marked `quiet` so nothing is announced, and shows the keys it is
 * "pressing" so the preview teaches the shortcuts too.
 *
 * `run` resolves when cancelled; every wait checks the signal, so stopping is
 * immediate rather than at the end of a step.
 */

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('stopped', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('stopped', 'AbortError')) }, { once: true })
  })

export async function runPreview({ dispatch, showKeys, signal }) {
  const q = (action) => dispatch({ ...action, quiet: true })
  const press = async (combo, label, action, hold = 950) => {
    showKeys({ combo, label })
    await sleep(260, signal)
    if (action) q(action)
    await sleep(hold, signal)
    showKeys(null)
  }

  try {
    for (;;) {
      q({ type: 'reset', full: true })
      await sleep(1600, signal)

      // Zen: sidebar, header, chips — and, by default, the input bar.
      await press('⌘⇧Z', 'Zen', { type: 'zen' })
      await sleep(1700, signal)
      await press('⌘⇧Z', 'Zen off', { type: 'zen' })
      await sleep(1100, signal)

      // Hide the input bar; typing brings it straight back.
      await press('⌘⇧H', 'Hide the input bar', { type: 'composer' })
      await sleep(1300, signal)
      showKeys({ combo: '', label: 'Start typing…' })
      for (const ch of 'So') {
        await sleep(300, signal)
        q({ type: ch === 'S' ? 'typeAhead' : 'draft', ch, value: 'So' })
      }
      await sleep(1100, signal)
      showKeys(null)
      q({ type: 'draft', value: '' })
      await sleep(700, signal)

      // ⌘K, search, Return.
      await press('⌘K', 'Command palette', { type: 'palette' }, 500)
      for (const query of ['f', 'fo', 'foc']) {
        await sleep(240, signal)
        q({ type: 'paletteQuery', query })
      }
      await sleep(700, signal)
      await press('↩', 'Run', { type: 'paletteRun' }, 600)

      // Focus Reader: fixation from 40 up to 60, down to 20, back to 40.
      await sleep(1200, signal)
      showKeys({ combo: '', label: 'Fixation strength' })
      const walk = [45, 50, 55, 60, 60, 55, 50, 45, 40, 35, 30, 25, 20, 20, 25, 30, 35, 40]
      for (const v of walk) {
        await sleep(230, signal)
        q({ type: 'readerSet', key: 'frFixation', value: v })
      }
      await sleep(900, signal)
      showKeys(null)
      await press('Esc', 'Close', { type: 'reader' })
      await sleep(900, signal)

      // A focus block: Zen comes on by itself.
      await press('', 'Focus timer · Classic 25/5', { type: 'preset', key: '25/5' }, 1400)
      await sleep(2600, signal)
      // End it the way the extension does — Escape does not stop a timer there.
      await press('', 'End ✕', { type: 'timerEnd' })
      await sleep(1800, signal)
    }
  } catch (err) {
    if (err?.name !== 'AbortError') throw err
  } finally {
    showKeys(null)
  }
}
