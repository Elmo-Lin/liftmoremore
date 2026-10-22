export function PageLoading() {
  return (
    <div className="flex min-h-40 items-center justify-center" role="status" aria-label="載入中">
      <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-accent-600" />
    </div>
  )
}
