// After a deploy, an app that was already open (e.g. the installed app left in the background) still
// asks for the previous build's lazily loaded files, which no longer exist. Reloading picks up the
// new build. Guarded so a real outage cannot cause a reload loop.

const KEY = 'liftmoremore:reloaded-at'

/** A failed lazy import (Chrome, Safari and Firefox word it differently). */
export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message)
}

/** Reloads unless we already did in the last 10 seconds. Returns whether it reloaded. */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 10_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // No storage: reload anyway; the browser's own cache makes a loop unlikely.
  }
  window.location.reload()
  return true
}
