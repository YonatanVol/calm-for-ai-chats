import { fixate } from '../lib/bionic'

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
 * The split is the extension's own (src/reader.js, via lib/bionic), and
 * `ratio` defaults to the extension's default fixation of 40%, so "set the
 * way Calm sets one" is literally true. The emphasis colour is the site's.
 */
export default function Bionic({ children, ratio = 0.4, className = '' }) {
  return (
    <span className={className}>
      {fixate(String(children), ratio).map(([bold, rest], i) =>
        bold === null ? rest : (
          <span key={i}>
            <b className="font-semibold text-text">{bold}</b>
            {rest}
          </span>
        )
      )}
    </span>
  )
}
