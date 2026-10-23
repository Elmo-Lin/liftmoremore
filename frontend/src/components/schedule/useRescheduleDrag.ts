import { useEffect, useRef, useState } from 'react'
import type { Appointment } from '../../types'

// Drag a class to another day in the week view.
// - Mouse: starts after moving a few pixels. Touch: starts after a long press, so a normal swipe
//   still scrolls the page.
// - Drop targets are elements with data-drop="yyyy-mm-dd" (a day) or "prev" / "next" (zones above
//   and below the week): resting on one flips the week, repeatedly, so a class can travel several weeks.
// - Near the top / bottom of the visible area (inside the phone's top bar and tab bar) the page
//   auto-scrolls, so every day and both zones are reachable on a phone.
// - Flipping the week unmounts the row the finger went down on, and touch input keeps targeting
//   that (now detached) element, so its events would no longer reach window listeners. Pointer
//   capture is moved to <html>, and the scroll blocker is also attached to the row itself.

const LONG_PRESS_MS = 350
const MOVE_TOLERANCE = 8
const FLIP_FIRST_MS = 600
const FLIP_REPEAT_MS = 1000
const SCROLL_BAND = 72

export type DropTarget = string | 'prev' | 'next' | null

export interface DragState {
  appointment: Appointment
  x: number
  y: number
  over: DropTarget
}

export function useRescheduleDrag({ onDrop, onFlipWeek }: { onDrop: (a: Appointment, day: string) => void; onFlipWeek: (dir: -1 | 1) => void }) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const justDragged = useRef(false)
  const handlers = useRef({ onDrop, onFlipWeek })
  useEffect(() => {
    handlers.current = { onDrop, onFlipWeek }
  })

  // Touch: once dragging, stop the browser from also scrolling the page.
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault()
    }
    window.addEventListener('touchmove', block, { passive: false })
    return () => window.removeEventListener('touchmove', block)
  }, [])

  const start = (e: React.PointerEvent, appointment: Appointment) => {
    if (e.button !== 0) return
    const origin = { x: e.clientX, y: e.clientY }
    const touch = e.pointerType !== 'mouse'
    const { pointerId } = e
    const row = e.currentTarget as HTMLElement
    const blockScroll = (ev: TouchEvent) => ev.preventDefault()
    let pressTimer: number | undefined
    let flipTimer: number | undefined
    let flipZone: DropTarget = null
    let frame = 0

    const update = (next: DragState | null) => {
      dragRef.current = next
      setDrag(next)
    }
    const begin = (x: number, y: number) => {
      try {
        document.documentElement.setPointerCapture(pointerId)
      } catch {
        // Pointer already gone (lifted during the long press); the pointerup handler cleans up.
      }
      row.addEventListener('touchmove', blockScroll, { passive: false })
      update({ appointment, x, y, over: null })
      navigator.vibrate?.(10)
      frame = requestAnimationFrame(autoScroll)
    }
    const targetAt = (x: number, y: number): DropTarget => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')
      return (el?.dataset.drop as DropTarget) ?? null
    }
    const autoScroll = () => {
      const d = dragRef.current
      if (!d) return
      // Hidden bars (desktop) report a zero rect, which falls back to the window edges.
      const top = Math.max(0, document.querySelector('[data-topbar]')?.getBoundingClientRect().bottom ?? 0)
      const tabBar = document.querySelector('[data-tabbar]')?.getBoundingClientRect()
      const bottom = tabBar && tabBar.height > 0 ? tabBar.top : window.innerHeight
      if (d.y < top + SCROLL_BAND) window.scrollBy(0, -Math.ceil((top + SCROLL_BAND - Math.max(d.y, top)) / 6))
      else if (d.y > bottom - SCROLL_BAND) window.scrollBy(0, Math.ceil((Math.min(d.y, bottom) - (bottom - SCROLL_BAND)) / 6))
      frame = requestAnimationFrame(autoScroll)
    }
    const setFlipZone = (zone: DropTarget) => {
      if (zone === flipZone) return
      window.clearTimeout(flipTimer)
      flipZone = zone
      if (zone !== 'prev' && zone !== 'next') return
      const flip = (delay: number) => {
        flipTimer = window.setTimeout(() => {
          handlers.current.onFlipWeek(zone === 'prev' ? -1 : 1)
          navigator.vibrate?.(10)
          flip(FLIP_REPEAT_MS)
        }, delay)
      }
      flip(FLIP_FIRST_MS)
    }

    const move = (ev: PointerEvent) => {
      if (!dragRef.current) {
        const moved = Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) > MOVE_TOLERANCE
        if (!moved) return
        if (touch) return cleanup() // a swipe before the long press finished: let the page scroll
        begin(ev.clientX, ev.clientY)
      }
      const over = targetAt(ev.clientX, ev.clientY)
      setFlipZone(over)
      update({ ...dragRef.current!, x: ev.clientX, y: ev.clientY, over })
    }
    const end = () => {
      const d = dragRef.current
      if (d) {
        justDragged.current = true
        window.setTimeout(() => (justDragged.current = false))
        if (d.over && d.over !== 'prev' && d.over !== 'next') handlers.current.onDrop(d.appointment, d.over)
      }
      cleanup()
    }
    const cleanup = () => {
      window.clearTimeout(pressTimer)
      window.clearTimeout(flipTimer)
      cancelAnimationFrame(frame)
      row.removeEventListener('touchmove', blockScroll)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cleanup)
      if (dragRef.current) update(null)
    }

    if (touch) pressTimer = window.setTimeout(() => begin(origin.x, origin.y), LONG_PRESS_MS)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cleanup)
  }

  /** Call from the row's onClick: a drag ending on the row must not also open the editor. */
  const consumeClick = () => justDragged.current

  return { drag, start, consumeClick }
}
