import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, loadGoogle } from '../../lib/google'

/** The latest callback is used, so the parent can pass an inline function. */
export function GoogleButton({ onCredential, text = 'continue_with' }: { onCredential: (credential: string) => void; text?: 'continue_with' | 'signup_with' }) {
  const ref = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    callback.current = onCredential
  })

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadGoogle()
      .then((google) => {
        if (cancelled || !ref.current) return
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID!, callback: (r) => callback.current(r.credential), ux_mode: 'popup' })
        google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          locale: 'zh-TW',
          width: Math.min(400, ref.current.clientWidth || 320),
        })
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [text])

  if (!GOOGLE_CLIENT_ID) return null
  return (
    <div>
      <div ref={ref} className="flex min-h-11 w-full justify-center" />
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  )
}
