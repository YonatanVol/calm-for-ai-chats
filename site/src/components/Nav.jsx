import { useEffect, useState } from 'react'
import Button from './Button'

const LINKS = [
  ['Read', '#read'],
  ['Focus', '#focus'],
  ['Privacy', '#privacy'],
  ['Shortcuts', '#shortcuts'],
  ['FAQ', '#faq'],
]

/**
 * Supaste's nav hangs from the top edge like a MacBook notch, because
 * the product lives in the notch. Calm's console is a floating pill
 * anchored to a corner, so the nav is a floating pill too — same
 * reasoning, different product, different shape.
 *
 * It also fades its border in only once you have scrolled, so at rest
 * the page opens with nothing but the headline.
 */
export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed inset-x-0 top-4 z-20 flex justify-center px-4">
      <nav
        className={`flex h-12 w-full max-w-[760px] items-center justify-between gap-6
          rounded-full pr-2 pl-5 transition-colors duration-500 ${
            scrolled
              ? 'border border-line bg-ink/85 backdrop-blur-xl'
              : 'border border-transparent bg-transparent'
          }`}
      >
        <a href="#" className="flex shrink-0 items-center gap-2.5">
          <img src="/icon128.png" alt="" width="20" height="20" className="h-5 w-5 rounded-[5px]" />
          <span className="type-display text-[17px]">Calm</span>
        </a>

        <ul className="hidden items-center gap-6 tablet:flex">
          {LINKS.map(([label, href]) => (
            <li key={label}>
              <a href={href} className="type-body text-ui text-muted transition-colors hover:text-text">
                {label}
              </a>
            </li>
          ))}
        </ul>

        <Button href="#install" size="sm" className="shrink-0">Install</Button>
      </nav>
    </div>
  )
}
