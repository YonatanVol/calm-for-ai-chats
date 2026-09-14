/**
 * Calm has no black-on-white CTA to borrow — the whole product is
 * dark. So the primary button is the one place the ember accent
 * appears at full strength, which is why it reads as the only thing
 * on the page asking to be clicked.
 */
export default function Button({ children, href = '#', variant = 'primary', size = 'lg', className = '' }) {
  const variants = {
    primary: 'bg-text text-void hover:bg-white',
    ghost: 'border border-line text-text hover:border-faint hover:bg-surface',
  }
  const sizes = { lg: 'px-7 py-3.5 text-body', sm: 'px-4 py-2 text-ui' }

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium
        transition-colors duration-300 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </a>
  )
}
