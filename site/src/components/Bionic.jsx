/**
 * CALM'S FLOURISH — the equivalent of Supaste's notch nav.
 *
 * Supaste's one custom element was a nav shaped like a MacBook notch,
 * because the product lives in the notch. Calm's signature feature is
 * bionic fixation: bolding the opening of each word so the eye has an
 * anchor to land on.
 *
 * So the site renders one line of its own copy that way. The page
 * demonstrates the product instead of describing it, and no other
 * landing page can borrow it, because no other product does this.
 *
 * `ratio` matches the extension's adjustable 20–60% fixation.
 */
export default function Bionic({ children, ratio = 0.42, className = '' }) {
  const text = String(children)

  return (
    <span className={className}>
      {text.split(/(\s+)/).map((chunk, i) => {
        if (/^\s+$/.test(chunk)) return chunk
        const letters = chunk.replace(/[^\p{L}\p{N}]/gu, '').length
        const cut = Math.max(1, Math.round(letters * ratio))
        // Count only letters toward the fixation point so punctuation
        // never eats into it.
        let seen = 0
        let split = chunk.length
        for (let c = 0; c < chunk.length; c++) {
          if (/[\p{L}\p{N}]/u.test(chunk[c])) seen++
          if (seen === cut) { split = c + 1; break }
        }
        return (
          <span key={i}>
            <b className="font-semibold text-text">{chunk.slice(0, split)}</b>
            {chunk.slice(split)}
          </span>
        )
      })}
    </span>
  )
}
