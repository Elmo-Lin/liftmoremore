import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const widths = { sm: 'md:max-w-md', md: 'md:max-w-lg', lg: 'md:max-w-2xl' }

// Stack of open dialogs so Escape only closes the topmost one.
const openStack: symbol[] = []

// Page scroll is locked while any dialog is open. A counter, not a per-dialog save/restore: with two
// dialogs closing in the other order, restoring each one's saved value left the page stuck unscrollable.
let scrollLocks = 0
let savedOverflow = ''
function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}
function unlockScroll() {
  if (scrollLocks > 0 && --scrollLocks === 0) document.body.style.overflow = savedOverflow
}

/** Mouse or trackpad. On touch screens, focusing a field pops the keyboard up, so dialogs don't. */
const finePointer = () => window.matchMedia?.('(pointer: fine)').matches ?? true

/** Dialog on desktop, bottom sheet on mobile. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Release focus from a field inside the dialog before it is removed: on iPhone, removing a focused
  // field leaves the page shifted by the keyboard and unresponsive to scrolling until the next tap.
  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    return () => {
      const active = document.activeElement as HTMLElement | null
      if (active && panel?.contains(active)) active.blur()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const token = Symbol('modal')
    openStack.push(token)
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === token) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    lockScroll()
    const fine = finePointer()
    const t = setTimeout(() => {
      const el = fine ? panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea') : null
      ;(el ?? panelRef.current)?.focus({ preventScroll: true })
    }, 30)
    return () => {
      clearTimeout(t)
      openStack.splice(openStack.indexOf(token), 1)
      document.removeEventListener('keydown', onKey)
      unlockScroll()
      // Back to where keyboard users were; on touch screens that could pop the keyboard up again.
      if (fine) prevFocus?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="animate-fade absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[14px] bg-surface shadow-2xl shadow-black/20 outline-none md:rounded-2xl ${widths[size]}`}
      >
        <span aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-ink-300/70 md:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-3 pb-3.5 md:pt-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink-900">{title}</h2>
            {description && <div className="mt-0.5 text-sm text-ink-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-ink-500 hover:text-ink-800"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
        {children != null && children !== false && <div className="overflow-y-auto px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:flex-row md:justify-end md:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '確認',
  cancelLabel = '取消',
  tone = 'primary',
  onConfirm,
  onCancel,
  children,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} className="h-11 md:h-10">
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} className="h-11 md:h-10" data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
