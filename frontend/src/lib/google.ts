// "Sign in with Google" (Google Identity Services). Google renders the button and hands back an ID
// token (`credential`) that the backend verifies. Hidden when VITE_GOOGLE_CLIENT_ID is not set.
export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }) => void
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

let loading: Promise<GoogleIdentity> | null = null

export function loadGoogle() {
  loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google 登入載入失敗')))
    script.onerror = () => {
      loading = null
      reject(new Error('Google 登入載入失敗，請檢查網路'))
    }
    document.head.append(script)
  })
  return loading
}

/** Name and email from a Google ID token, for display only (the server verifies it). */
export function googleProfile(credential: string): { name?: string; email?: string } {
  try {
    const payload = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return {}
  }
}
