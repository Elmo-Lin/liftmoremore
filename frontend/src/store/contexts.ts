import { createContext, useContext } from 'react'
import type { AppData, DemoSession } from '../types'
import type { DataActions } from './actions'

export type SyncStatus = 'local' | 'loading' | 'ready' | 'error'

export interface DataContextValue {
  data: AppData
  actions: DataActions
  /** 'local' = offline demo (localStorage); otherwise the backend connection state. */
  status: SyncStatus
  /** Re-download everything from the backend (API mode). */
  reload: () => Promise<void>
}

export const DataContext = createContext<DataContextValue | null>(null)

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}

export interface SessionContextValue {
  session: DemoSession | null
  signIn: (session: DemoSession) => void
  signOut: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

export interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.notify
}
