import { useReveal } from '../hooks/useReveal'

/**
 * The three motion effects measured on the original, and nothing else:
 *
 *   <Reveal>              opacity 0→1 + translateY(30px)   — the default,
 *                                                            used everywhere
 *   <Reveal x={-20}>      opacity 0→1 + translateX(±20px)  — paired
 *                                                            left/right elements
 *   <Reveal scale={1.2} y={100}>  the single hero parallax
 *
 * Resisting the urge to add a fourth is most of what makes the page
 * feel coherent.
 */
export default function Reveal({
  children,
  y = 12,
  x = 0,
  scale = 1,
  delay = 0,
  as: Tag = 'div',
  className = '',
  ...rest
}) {
  const [ref, inView] = useReveal()

  const from = [
    x ? `translateX(${x}px)` : '',
    y ? `translateY(${y}px)` : '',
    scale !== 1 ? `scale(${scale})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? 'reveal-in' : ''} ${className}`}
      style={{
        transform: inView ? undefined : from || undefined,
        transitionDelay: delay ? `${delay}ms` : undefined,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
