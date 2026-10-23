import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reloadOnce } from '../../lib/reload'

/**
 * Last line of defence: a render error (or a page file that could not load) shows a way out
 * instead of a blank screen. A missing page file after a deploy reloads into the new version.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnce()) return
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <p className="text-lg font-semibold text-ink-900">頁面載入失敗</p>
        <p className="max-w-sm text-sm text-ink-600">可能是網站剛更新，或網路不穩定。重新整理通常就能解決，你的資料都還在。</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 rounded-lg bg-accent-600 px-5 text-[15px] font-medium text-white hover:bg-accent-700"
        >
          重新整理
        </button>
      </div>
    )
  }
}
