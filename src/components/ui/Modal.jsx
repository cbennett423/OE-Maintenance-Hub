import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Generic modal primitive. Dark card, yellow top border, centered on backdrop.
 * Closes on Escape or backdrop click.
 */
export default function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        className={`w-full ${widths[size] || widths.md} bg-black-card border border-border border-t-4 border-t-cat-yellow rounded-lg shadow-2xl flex flex-col max-h-[90vh]`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-text">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-muted hover:text-text transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
