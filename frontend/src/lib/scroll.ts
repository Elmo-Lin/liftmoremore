import type { MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * For "home" links such as the logo: on the page the link points to already, scroll smoothly back
 * to the top (dropping any #section) instead of navigating, which would otherwise do nothing.
 */
export function useScrollTopIfCurrent(to: string) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  return (e: MouseEvent) => {
    if (pathname !== to) return
    e.preventDefault()
    if (hash) navigate(to, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
