/**
 * 1120px. The number isn't arbitrary — the grids close on it exactly:
 *   550 + 20 + 550 = 1120
 *   360×3 + 20×2   = 1120
 * Pick a container width that your grid math resolves into, and every
 * section lines up for free.
 */
export default function Container({ children, prose = false, className = '' }) {
  return (
    <div
      className={`mx-auto w-full px-5 tablet:px-10 ${
        prose ? 'max-w-[940px]' : 'max-w-[1120px]'
      } ${className}`}
    >
      {children}
    </div>
  )
}
