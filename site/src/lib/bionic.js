/**
 * Bionic fixation, ported line for line from the extension's src/reader.js
 * (boldCount + safeCut + the whitespace split in applyBionic), so the page
 * bolds exactly the letters Calm would.
 *
 * `frac` is the fixation strength as a fraction: the extension's slider runs
 * 20–60 and defaults to 40.
 */

// Bold the first portion of each word so the eye has an anchor per word.
export function boldCount(len, frac) {
  if (len <= 1) return 1
  return Math.max(1, Math.min(len - 1, Math.round(len * frac)))
}

// Never cut inside a surrogate pair or before combining marks (Hebrew
// niqqud/cantillation, Arabic harakat) — the bold boundary would otherwise
// split a single visible glyph across two elements.
export function safeCut(tok, cut) {
  const c = tok.charCodeAt(cut - 1)
  if (c >= 0xd800 && c <= 0xdbff) cut++ // high surrogate: keep the pair
  while (cut < tok.length) {
    const n = tok.charCodeAt(cut)
    const combining =
      (n >= 0x0300 && n <= 0x036f) || (n >= 0x0591 && n <= 0x05c7) ||
      (n >= 0x0610 && n <= 0x065f) || (n >= 0xdc00 && n <= 0xdfff)
    if (!combining) break
    cut++
  }
  return Math.min(cut, tok.length)
}

/**
 * Split text into [bold, rest] pairs. Whitespace runs come back as
 * [null, spaces] so callers can render them untouched.
 */
export function fixate(text, frac) {
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((tok) => {
      if (/^\s+$/.test(tok)) return [null, tok]
      const cut = safeCut(tok, boldCount(tok.length, frac))
      return [tok.slice(0, cut), tok.slice(cut)]
    })
}
