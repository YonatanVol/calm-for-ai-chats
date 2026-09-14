/**
 * Which modifier to print. Calm accepts Ctrl or ⌘ on every platform (its
 * handlers test `ctrlKey || metaKey`), so this only decides the LABEL: Mac
 * readers see ⌘, everyone else sees Ctrl. iPad and iPhone count as Mac —
 * their hardware keyboards have ⌘.
 */
function detectMac() {
  if (typeof navigator === 'undefined') return true
  const p = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(p)
}

export const IS_MAC = detectMac()

/**
 * "⌘⇧Z" → "⌘⇧Z" on a Mac, "Ctrl+Shift+Z" elsewhere. Written in Mac glyphs
 * once, so copy stays readable in the source. ⌃ (the extension's own palette
 * hints use it) is Ctrl everywhere.
 */
export function keys(combo) {
  if (IS_MAC) return combo
  const out = []
  let rest = ''
  for (const ch of combo) {
    if (ch === '⌘' || ch === '⌃') out.push('Ctrl')
    else if (ch === '⇧') out.push('Shift')
    else if (ch === '⌥') out.push('Alt')
    else rest += ch
  }
  if (rest) out.push(rest)
  return out.join('+')
}

/** Replace every glyph shortcut inside a sentence. */
export function keysIn(text) {
  return IS_MAC ? text : text.replace(/[⌘⌃⇧⌥]+[A-Z0-9]/g, (m) => keys(m))
}

/** aria-keyshortcuts value: "Meta+Shift+Z" on a Mac, "Control+Shift+Z" elsewhere. */
export function ariaKeys(combo) {
  const names = { '⌘': IS_MAC ? 'Meta' : 'Control', '⌃': 'Control', '⇧': 'Shift', '⌥': 'Alt' }
  return [...combo].map((ch) => names[ch] || ch).join('+')
}

/** Spoken form for screen readers: "Command Shift Z" / "Control Shift Z". */
export function spoken(combo) {
  const names = { '⌘': IS_MAC ? 'Command' : 'Control', '⌃': 'Control', '⇧': 'Shift', '⌥': IS_MAC ? 'Option' : 'Alt' }
  return [...combo].map((ch) => names[ch] || ch).join(' ')
}
