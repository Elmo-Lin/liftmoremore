import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { api, ApiError, isApiMode } from '../api/client'
import { requestsFor } from '../api/sync'
import { generateDemoData, SCHEMA_VERSION, type DemoSpace } from '../data/mock'
import { viewAsCoach } from '../lib/scope'
import type { AppData, DemoSession, ID, Role } from '../types'
import { createActions, type DataActions } from './actions'
import {
  DataContext,
  SessionContext,
  ToastContext,
  useSession,
  useToast,
  type SyncStatus,
  type Toast,
  type ToastKind,
} from './contexts'
import { dataKey, readJSON, STORAGE_KEYS, writeJSON } from './storage'

function loadData(space: DemoSpace): AppData {
  const stored = readJSON<AppData>(dataKey(space))
  // Demo data saved before workspaces existed has no `studio`; it no longer matches any persona, so regenerate.
  if (stored && stored.schemaVersion === SCHEMA_VERSION && Array.isArray(stored.students) && stored.studio) return stored
  const fresh = generateDemoData(space)
  writeJSON(dataKey(space), fresh)
  return fresh
}

/** Placeholder until the backend bootstrap arrives (API mode). */
function emptyData(): AppData {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: now,
    coach: { id: '', role: 'coach', name: '', email: '', title: '', studio: '', createdAt: now },
    students: [],
    relationships: [],
    exercises: [],
    plans: [],
    workouts: [],
    packages: [],
    transactions: [],
    metrics: [],
    appointments: [],
  }
}

/**
 * Tiny external store: synchronous reads for validation; persisted to localStorage only in
 * demo mode. In API mode it also holds the auth token and connection status, and owns the
 * sync queue that mirrors every successful local action to the backend.
 */
function createDataStore(onSignOut: () => void, notify: (m: string, k?: ToastKind) => void) {
  // Offline demo: the workspace of whoever is signed in (switching persona can switch workspace).
  let space: DemoSpace = readJSON<DemoSession>(STORAGE_KEYS.session)?.space ?? 'studio'
  let data = isApiMode ? emptyData() : loadData(space)
  let role: Role = 'coach'
  let actingCoach: ID | undefined
  let token: string | undefined
  let status: SyncStatus = isApiMode ? 'loading' : 'local'
  let queue: Promise<unknown> = Promise.resolve()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  const store = {
    get: () => data,
    getStatus: () => status,
    set: (next: AppData) => {
      data = next
      if (!isApiMode) writeJSON(dataKey(space), next)
      emit()
    },
    /** Replace without persisting (used when another tab already wrote, or after a download). */
    replace: (next: AppData) => {
      data = next
      emit()
    },
    getRole: () => role,
    getSpace: () => space,
    getActingCoach: () => actingCoach,
    subscribe: (l: () => void) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },

    /** Called whenever the signed-in session changes. */
    setSession: (s: DemoSession | null) => {
      role = s?.role ?? 'coach'
      actingCoach = s?.coachId
      if (!isApiMode) {
        const next = s?.space ?? 'studio'
        if (next !== space) {
          space = next
          data = loadData(space)
          emit()
        }
        return
      }
      if (s?.token === token) return
      token = s?.token
      // Never show one account's data to the next: start from empty on every sign-in/out.
      data = emptyData()
      status = 'loading'
      emit()
      if (token) void store.reload()
    },

    reload: async () => {
      if (!isApiMode || !token) return
      const forToken = token
      try {
        const next = await api<AppData>('GET', '/bootstrap', undefined, forToken)
        if (forToken !== token) return // signed out / switched meanwhile
        data = next
        status = 'ready'
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          onSignOut()
          notify('登入已過期，請重新登入', 'info')
          return
        }
        status = 'error'
        notify(e instanceof Error ? e.message : '無法載入資料', 'error')
      }
      emit()
    },

    /** Wrap local actions so each success is queued to the backend (API mode only). */
    syncActions: (base: DataActions): DataActions => {
      if (!isApiMode) return base
      const wrapped = {} as Record<string, unknown>
      for (const name of Object.keys(base) as (keyof DataActions)[]) {
        const fn = base[name] as (...a: unknown[]) => unknown
        wrapped[name] = (...args: unknown[]) => {
          const before = data
          const result = fn(...args) as { ok: boolean; value?: unknown } | undefined
          if (result && result.ok === false) return result
          for (const r of requestsFor(name, args, result?.value, before, data) ?? []) {
            queue = queue
              .then(() => api(r.method, r.path, r.body, token))
              .catch((e) => {
                notify(e instanceof Error ? `同步失敗：${e.message}` : '同步失敗', 'error')
                void store.reload()
              })
          }
          return result
        }
      }
      return wrapped as unknown as DataActions
    },
  }
  return store
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(() => {
    const stored = readJSON<DemoSession>(STORAGE_KEYS.session)
    // A token-less session is a leftover offline-demo sign-in; against the backend it would show empty data.
    if (stored && isApiMode && !stored.token) {
      writeJSON(STORAGE_KEYS.session, null)
      return null
    }
    return stored
  })
  const signIn = useCallback((s: DemoSession) => {
    writeJSON(STORAGE_KEYS.session, s)
    setSession(s)
  }, [])
  const signOut = useCallback(() => {
    writeJSON(STORAGE_KEYS.session, null)
    setSession(null)
  }, [])
  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession()
  const notify = useToast()
  const [store] = useState(() => createDataStore(signOut, notify))
  const [actions] = useState(() => store.syncActions(createActions(store.get, store.set, store.getRole, store.getActingCoach)))
  const all = useSyncExternalStore(store.subscribe, store.get)
  // Offline demo acting as a studio coach: show only what that coach would see from the server.
  const data = useMemo(() => (!isApiMode && session?.role === 'coach' && session.coachId ? viewAsCoach(all, session.coachId) : all), [all, session])
  const status = useSyncExternalStore(store.subscribe, store.getStatus)

  useEffect(() => {
    store.setSession(session)
  }, [store, session])

  // Keep tabs in sync when another tab changes the demo data.
  useEffect(() => {
    if (isApiMode) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== dataKey(store.getSpace()) || !e.newValue) return
      try {
        store.replace(JSON.parse(e.newValue) as AppData)
      } catch {
        /* ignore malformed payloads */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [store])

  const value = useMemo(() => ({ data, everything: all, actions, status, reload: store.reload }), [data, all, actions, status, store])
  // Before the session effect runs on a fresh sign-in, the store may still hold no data.
  const waiting = isApiMode && session?.token && (status !== 'ready' || !data.coach.id)
  return (
    <DataContext.Provider value={value}>
      {waiting ? <ConnectionScreen status={status} onRetry={() => void store.reload()} onSignOut={signOut} /> : children}
    </DataContext.Provider>
  )
}

function ConnectionScreen({ status, onRetry, onSignOut }: { status: SyncStatus; onRetry: () => void; onSignOut: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      {status === 'error' ? (
        <>
          <p className="text-[17px] font-semibold text-ink-900">無法連線到伺服器</p>
          <p className="text-[15px] text-ink-500">請確認後端已啟動，或稍後再試。</p>
          <div className="flex gap-2">
            <button type="button" onClick={onRetry} className="h-10 rounded-lg bg-accent-600 px-4 text-[15px] font-semibold text-white">
              重試
            </button>
            <button type="button" onClick={onSignOut} className="h-10 rounded-lg bg-fill px-4 text-[15px] text-accent-700">
              登出
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-accent-600" />
          <p className="text-[15px] text-ink-500">正在載入資料…</p>
        </>
      )}
    </div>
  )
}

const TOAST_ICON = { success: CheckCircle2, error: XCircle, info: Info }
const TOAST_TONE = {
  success: 'text-accent-600',
  error: 'text-danger-600',
  info: 'text-ink-500',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 4500 : 3000)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.kind]
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="animate-toast pointer-events-auto flex max-w-sm items-start gap-2.5 material rounded-2xl px-4 py-3 text-[15px] text-ink-900 shadow-xl shadow-black/10 ring-1 ring-black/5"
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${TOAST_TONE[t.kind]}`} />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
