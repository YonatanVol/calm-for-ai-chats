import { useEffect, useRef, useState } from 'react'

/**
 * The whole scroll-animation engine of supaste.com, reimplemented.
 *
 * The original loads no animation library at all — `window` has no
 * gsap, no Lenis, no Motion. Elements simply sit at opacity:0 with a
 * transform, and an IntersectionObserver flips them on once. That is
 * the entire mechanism, and it is ~25 lines.
 *
 * `once: true` matches the original: elements never re-hide on scroll
 * back up, which avoids the flickery feel of re-triggering reveals.
 */
export function useReveal({ threshold = 0.15, once = true, rootMargin = '0px 0px -80px 0px' } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect the user's motion preference — show everything immediately.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, once, rootMargin])

  return [ref, inView]
}
